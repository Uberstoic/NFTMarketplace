import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockNFT, Marketplace } from "../typechain-types";
import { BigNumber } from "ethers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("NFT Marketplace", function () {
  let marketplace: Marketplace;
  let mockNFT: MockNFT;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy MockNFT
    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy();
    await marketplace.deployed();

    // Set up contract relationships
    await marketplace.setNFTContract(mockNFT.address);
    await mockNFT.setMarketplace(marketplace.address);
  });

  describe("Deployment", function () {
    it("Should set the correct NFT contract address", async function () {
      expect(await marketplace.nftContract()).to.equal(mockNFT.address);
    });
  });

  describe("Item Creation and Listing", function () {
    it("Should create and list an item", async function () {
      // Create item (which mints NFT)
      const createTx = await marketplace.connect(addr1).createItem(1);
      await createTx.wait();

      expect(await mockNFT.ownerOf(1)).to.equal(addr1.address);

      // Approve marketplace before listing
      await mockNFT.connect(addr1).approve(marketplace.address, 1);

      // List item
      const price = ethers.utils.parseEther("1");
      const listTx = await marketplace.connect(addr1).listItem(1, price);
      await listTx.wait();
      
      const storedPrice = await marketplace.itemPrices(1);
      expect(storedPrice.toString()).to.equal(price.toString());
      expect(await marketplace.itemOwners(1)).to.equal(addr1.address);
    });

    it("Should fail to list item if not approved", async function () {
      await marketplace.connect(addr1).createItem(1);
      
      const price = ethers.utils.parseEther("1");
      await expect(marketplace.connect(addr1).listItem(1, price))
        .to.be.revertedWith("Marketplace not approved");
    });

    it("Should fail to create item if token ID already exists", async function () {
      // First creation should succeed
      await marketplace.connect(addr1).createItem(1);
      
      // Second creation with same ID should fail
      await expect(marketplace.connect(addr2).createItem(1))
        .to.be.revertedWith("Token already exists");
    });

    it("Should fail to list item if price is zero", async function () {
      await marketplace.connect(addr1).createItem(1);
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      
      await expect(marketplace.connect(addr1).listItem(1, 0))
        .to.be.revertedWith("Price must be greater than 0");
    });

    it("Should fail to list item if not owner", async function () {
      await marketplace.connect(addr1).createItem(1);
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      
      await expect(marketplace.connect(addr2).listItem(1, ethers.utils.parseEther("1")))
        .to.be.revertedWith("Not owner");
    });

    it("Should allow canceling a listed item", async function () {
      await marketplace.connect(addr1).createItem(1);
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItem(1, ethers.utils.parseEther("1"));
      
      await marketplace.connect(addr1).cancel(1);
      const price = await marketplace.itemPrices(1);
      expect(price.toString()).to.equal("0");
    });

    it("Should fail to cancel if not owner", async function () {
      await marketplace.connect(addr1).createItem(1);
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItem(1, ethers.utils.parseEther("1"));
      
      await expect(marketplace.connect(addr2).cancel(1))
        .to.be.revertedWith("Not owner");
    });
  });

  describe("Buying Items", function () {
    const PRICE = ethers.utils.parseEther("1");

    beforeEach(async function () {
      await marketplace.connect(addr1).createItem(1);
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItem(1, PRICE);
    });

    it("Should allow buying a listed item", async function () {
      const initialBalance = await addr1.getBalance();
      
      await marketplace.connect(addr2).buyItem(1, { value: PRICE });
      
      expect(await mockNFT.ownerOf(1)).to.equal(addr2.address);
      expect(await addr1.getBalance()).to.equal(initialBalance.add(PRICE));
    });

    it("Should fail if payment is insufficient", async function () {
      await expect(
        marketplace.connect(addr2).buyItem(1, { value: PRICE.sub(1) })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should fail if item is not listed", async function () {
      await marketplace.connect(addr1).cancel(1);
      
      await expect(
        marketplace.connect(addr2).buyItem(1, { value: PRICE })
      ).to.be.revertedWith("Item not for sale");
    });
  });

  describe("Direct Sales", function () {
    beforeEach(async function () {
      await marketplace.connect(addr1).createItem(1);
    });

    it("Should fail to buy unlisted item", async function () {
      const price = ethers.utils.parseEther("1");
      await expect(marketplace.connect(addr2).buyItem(1, { value: price }))
        .to.be.revertedWith("Item not for sale");
    });

    it("Should fail to buy item with insufficient funds", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      const price = ethers.utils.parseEther("1");
      await marketplace.connect(addr1).listItem(1, price);

      const lowPrice = ethers.utils.parseEther("0.5");
      await expect(marketplace.connect(addr2).buyItem(1, { value: lowPrice }))
        .to.be.revertedWith("Insufficient payment");
    });

    it("Should transfer payment to seller after successful purchase", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      const price = ethers.utils.parseEther("1");
      await marketplace.connect(addr1).listItem(1, price);

      const sellerBalanceBefore = await ethers.provider.getBalance(addr1.address);
      
      await marketplace.connect(addr2).buyItem(1, { value: price });
      
      const sellerBalanceAfter = await ethers.provider.getBalance(addr1.address);
      expect(sellerBalanceAfter.sub(sellerBalanceBefore)).to.equal(price);
    });

    it("Should emit ItemSold event after successful purchase", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      const price = ethers.utils.parseEther("1");
      await marketplace.connect(addr1).listItem(1, price);

      await expect(marketplace.connect(addr2).buyItem(1, { value: price }))
        .to.emit(marketplace, "ItemSold")
        .withArgs(addr2.address, 1, price);
    });

    it("Should fail to list item with zero price", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await expect(marketplace.connect(addr1).listItem(1, 0))
        .to.be.revertedWith("Price must be greater than 0");
    });

    it("Should fail to list if not owner", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      const price = ethers.utils.parseEther("1");
      await expect(marketplace.connect(addr2).listItem(1, price))
        .to.be.revertedWith("Not owner");
    });

    it("Should allow owner to cancel listing", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      const price = ethers.utils.parseEther("1");
      await marketplace.connect(addr1).listItem(1, price);

      await marketplace.connect(addr1).cancel(1);
      
      // Try to buy the canceled listing
      await expect(marketplace.connect(addr2).buyItem(1, { value: price }))
        .to.be.revertedWith("Item not for sale");
    });

    it("Should fail to cancel if not owner", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      const price = ethers.utils.parseEther("1");
      await marketplace.connect(addr1).listItem(1, price);

      await expect(marketplace.connect(addr2).cancel(1))
        .to.be.revertedWith("Not owner");
    });

    it("Should fail to cancel if item not listed", async function () {
      await expect(marketplace.connect(addr1).cancel(1))
        .to.be.revertedWith("Item not listed");
    });

    it("Should allow owner to update price", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      const oldPrice = ethers.utils.parseEther("1");
      await marketplace.connect(addr1).listItem(1, oldPrice);

      const newPrice = ethers.utils.parseEther("2");
      await marketplace.connect(addr1).listItem(1, newPrice);

      // Try to buy with old price
      await expect(marketplace.connect(addr2).buyItem(1, { value: oldPrice }))
        .to.be.revertedWith("Insufficient payment");
    });
  });

  describe("Auction Features", function () {
    beforeEach(async function () {
      await marketplace.connect(addr1).createItem(1);
    });

    it("Should start an auction", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      const auction = await marketplace.auctions(1);
      expect(auction.active).to.be.true;
      expect(auction.seller).to.equal(addr1.address);
      expect(await mockNFT.ownerOf(1)).to.equal(marketplace.address);
    });

    it("Should place a bid", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      const bidAmount = ethers.utils.parseEther("1");
      
      await marketplace.connect(addr2).makeBid(1, { value: bidAmount });
      
      const auction = await marketplace.auctions(1);
      expect(auction.highestBid.toString()).to.equal(bidAmount.toString());
      expect(auction.highestBidder).to.equal(addr2.address);
    });

    it("Should finish auction", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      // First bid
      const firstBidAmount = ethers.utils.parseEther("1");
      await marketplace.connect(addr2).makeBid(1, { value: firstBidAmount });
      
      // Second bid
      const secondBidAmount = ethers.utils.parseEther("2");
      await marketplace.connect(addrs[0]).makeBid(1, { value: secondBidAmount });
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // 3 days
      await ethers.provider.send("evm_mine", []);
      
      await marketplace.finishAuction(1);
      
      expect(await mockNFT.ownerOf(1)).to.equal(addrs[0].address);
      const auction = await marketplace.auctions(1);
      expect(auction.active).to.be.false;
    });

    it("Should fail to list item on auction if not approved", async function () {
      await expect(marketplace.connect(addr1).listItemOnAuction(1))
        .to.be.revertedWith("Marketplace not approved");
    });

    it("Should fail to list item on auction if already active", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      await expect(marketplace.connect(addr1).listItemOnAuction(1))
        .to.be.revertedWith("Auction already active");
    });

    it("Should fail to make bid if auction is not active", async function () {
      const bidAmount = ethers.utils.parseEther("1");
      await expect(marketplace.connect(addr2).makeBid(1, { value: bidAmount }))
        .to.be.revertedWith("Auction inactive");
    });

    it("Should fail to make bid if auction has ended", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      // Fast forward time past auction duration
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]); // 3 days + 1 second
      await ethers.provider.send("evm_mine", []);
      
      const bidAmount = ethers.utils.parseEther("1");
      await expect(marketplace.connect(addr2).makeBid(1, { value: bidAmount }))
        .to.be.revertedWith("Auction ended");
    });

    it("Should fail to make bid if bid is too low", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      // First bid
      const firstBidAmount = ethers.utils.parseEther("2");
      await marketplace.connect(addr2).makeBid(1, { value: firstBidAmount });
      
      // Second bid with lower amount
      const secondBidAmount = ethers.utils.parseEther("1");
      await expect(marketplace.connect(addrs[0]).makeBid(1, { value: secondBidAmount }))
        .to.be.revertedWith("Bid too low");
    });

    it("Should refund previous bidder when new bid is placed", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      // First bid
      const firstBidAmount = ethers.utils.parseEther("1");
      await marketplace.connect(addr2).makeBid(1, { value: firstBidAmount });
      
      // Get addr2's balance before refund
      const balanceBefore = await ethers.provider.getBalance(addr2.address);
      
      // Second bid
      const secondBidAmount = ethers.utils.parseEther("2");
      await marketplace.connect(addrs[0]).makeBid(1, { value: secondBidAmount });
      
      // Get addr2's balance after refund
      const balanceAfter = await ethers.provider.getBalance(addr2.address);
      
      // Check that the previous bidder was refunded
      expect(balanceAfter.sub(balanceBefore)).to.equal(firstBidAmount);
    });

    it("Should fail to finish auction if not ended", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      const bidAmount = ethers.utils.parseEther("1");
      await marketplace.connect(addr2).makeBid(1, { value: bidAmount });
      
      await expect(marketplace.finishAuction(1))
        .to.be.revertedWith("Auction not over");
    });

    it("Should return NFT to seller if less than 2 bids were made", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      // Only one bid
      const bidAmount = ethers.utils.parseEther("1");
      await marketplace.connect(addr2).makeBid(1, { value: bidAmount });
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // 3 days
      await ethers.provider.send("evm_mine", []);
      
      // Get bidder's balance before
      const balanceBefore = await ethers.provider.getBalance(addr2.address);
      
      await marketplace.finishAuction(1);
      
      // Check NFT was returned to seller
      expect(await mockNFT.ownerOf(1)).to.equal(addr1.address);
      
      // Check bidder was refunded
      const balanceAfter = await ethers.provider.getBalance(addr2.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(bidAmount);
    });

    it("Should allow seller to cancel auction with no bids", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      await marketplace.connect(addr1).cancelAuction(1);
      
      const auction = await marketplace.auctions(1);
      expect(auction.active).to.be.false;
    });

    it("Should fail to cancel auction if not seller", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      await expect(marketplace.connect(addr2).cancelAuction(1))
        .to.be.revertedWith("Not auction creator");
    });

    it("Should fail to cancel auction if it has bids", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      const bidAmount = ethers.utils.parseEther("1");
      await marketplace.connect(addr2).makeBid(1, { value: bidAmount });
      
      await expect(marketplace.connect(addr1).cancelAuction(1))
        .to.be.revertedWith("Cannot cancel with bids");
    });

    it("Should fail to cancel auction if already ended", async function () {
      await mockNFT.connect(addr1).approve(marketplace.address, 1);
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // 3 days
      await ethers.provider.send("evm_mine", []);
      
      await expect(marketplace.connect(addr1).cancelAuction(1))
        .to.be.revertedWith("Auction ended");
    });
  });
});
