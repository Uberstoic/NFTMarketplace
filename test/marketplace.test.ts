import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockNFT, Marketplace } from "../typechain-types";
import { BigNumber } from "ethers";

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
    marketplace = await Marketplace.deploy(mockNFT.address);
    await marketplace.deployed();
  });

  describe("Item Creation and Listing", function () {
    it("Should create and list an item", async function () {
      // Mint NFT
      await mockNFT.connect(addr1).mint(1);
      
      // Approve marketplace for all
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      
      // Create item
      const createTx = await marketplace.connect(addr1).createItem(1);
      await createTx.wait();

      // List item
      const price = ethers.utils.parseEther("1");
      const listTx = await marketplace.connect(addr1).listItem(1, price);
      await listTx.wait();
      
      const storedPrice = await marketplace.itemPrices(1);
      expect(storedPrice.toString()).to.equal(price.toString());
      expect(await marketplace.itemOwners(1)).to.equal(addr1.address);
    });

    it("Should fail to create item if not owner", async function () {
      await mockNFT.connect(addr1).mint(1);
      
      try {
        await marketplace.connect(addr2).createItem(1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Not token owner");
      }
    });

    it("Should fail to list item if price is zero", async function () {
      await mockNFT.connect(addr1).mint(1);
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      await marketplace.connect(addr1).createItem(1);
      
      try {
        await marketplace.connect(addr1).listItem(1, 0);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Price must be greater than 0");
      }
    });

    it("Should fail to list item if not owner", async function () {
      await mockNFT.connect(addr1).mint(1);
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      await marketplace.connect(addr1).createItem(1);
      
      try {
        await marketplace.connect(addr2).listItem(1, ethers.utils.parseEther("1"));
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Not owner");
      }
    });

    it("Should allow canceling a listed item", async function () {
      await mockNFT.connect(addr1).mint(1);
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      await marketplace.connect(addr1).createItem(1);
      await marketplace.connect(addr1).listItem(1, ethers.utils.parseEther("1"));
      
      await marketplace.connect(addr1).cancel(1);
      const price = await marketplace.itemPrices(1);
      expect(price.toString()).to.equal("0");
    });

    it("Should fail to cancel if item not listed", async function () {
      await mockNFT.connect(addr1).mint(1);
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      await marketplace.connect(addr1).createItem(1);
      
      try {
        await marketplace.connect(addr1).cancel(1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Item not listed");
      }
    });
  });

  describe("Buying Items", function () {
    beforeEach(async function () {
      await mockNFT.connect(addr1).mint(1);
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      await marketplace.connect(addr1).createItem(1);
      await marketplace.connect(addr1).listItem(1, ethers.utils.parseEther("1"));
    });

    it("Should allow buying an item", async function () {
      const initialBalance = await addr1.getBalance();
      const buyTx = await marketplace.connect(addr2).buyItem(1, { value: ethers.utils.parseEther("1") });
      await buyTx.wait();

      // Check NFT ownership
      const newOwner = await marketplace.itemOwners(1);
      expect(newOwner).to.equal(addr2.address);

      // Check seller received payment
      const finalBalance = await addr1.getBalance();
      const difference = finalBalance.sub(initialBalance);
      expect(difference.toString()).to.equal(ethers.utils.parseEther("1").toString());
    });

    it("Should fail if incorrect price", async function () {
      try {
        await marketplace.connect(addr2).buyItem(1, { value: ethers.utils.parseEther("0.5") });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Insufficient payment");
      }
    });

    it("Should fail to buy non-existent item", async function () {
      try {
        await marketplace.connect(addr2).buyItem(999, { value: ethers.utils.parseEther("1") });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Item not for sale");
      }
    });
  });

  describe("Auction Features", function () {
    beforeEach(async function () {
      await mockNFT.connect(addr1).mint(1);
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      await marketplace.connect(addr1).createItem(1);
    });

    it("Should start an auction", async function () {
      const auctionTx = await marketplace.connect(addr1).listItemOnAuction(1);
      await auctionTx.wait();

      const auction = await marketplace.auctions(1);
      expect(auction.active).to.be.true;
      expect(auction.seller).to.equal(addr1.address);
    });

    it("Should place a bid", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);

      const bidAmount = ethers.utils.parseEther("2");
      const bidTx = await marketplace.connect(addr2).makeBid(1, { value: bidAmount });
      await bidTx.wait();

      const auction = await marketplace.auctions(1);
      expect(auction.highestBidder).to.equal(addr2.address);
      expect(auction.highestBid.toString()).to.equal(bidAmount.toString());
    });

    it("Should fail to place lower bid", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);
      await marketplace.connect(addr2).makeBid(1, { value: ethers.utils.parseEther("2") });

      try {
        await marketplace.connect(addr2).makeBid(1, { value: ethers.utils.parseEther("1") });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Bid too low");
      }
    });

    it("Should finish auction", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);
      await marketplace.connect(addr2).makeBid(1, { value: ethers.utils.parseEther("2") });
      await marketplace.connect(addrs[0]).makeBid(1, { value: ethers.utils.parseEther("3") });

      // Increase time
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      const finishTx = await marketplace.finishAuction(1);
      await finishTx.wait();

      expect(await mockNFT.ownerOf(1)).to.equal(addrs[0].address);
    });

    it("Should fail to finish auction early", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);

      try {
        await marketplace.finishAuction(1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Auction not over");
      }
    });

    it("Should cancel auction", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);

      const cancelTx = await marketplace.connect(addr1).cancelAuction(1);
      await cancelTx.wait();

      const auction = await marketplace.auctions(1);
      expect(auction.active).to.be.false;
    });

    it("Should fail to cancel if not seller", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);

      try {
        await marketplace.connect(addr2).cancelAuction(1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Not auction creator");
      }
    });

    it("Should fail to start auction if already active", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      try {
        await marketplace.connect(addr1).listItemOnAuction(1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Auction already active");
      }
    });

    it("Should refund previous bidder when new bid is placed", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);
      
      // First bid
      const firstBidAmount = ethers.utils.parseEther("1");
      await marketplace.connect(addr2).makeBid(1, { value: firstBidAmount });
      
      // Get balance before second bid
      const balanceBefore = await ethers.provider.getBalance(addr2.address);
      
      // Second bid
      await marketplace.connect(addrs[0]).makeBid(1, { value: ethers.utils.parseEther("2") });
      
      // Check refund (approximately equal due to gas costs)
      const balanceAfter = await ethers.provider.getBalance(addr2.address);
      const difference = balanceAfter.sub(balanceBefore);
      expect(difference.toString()).to.equal(firstBidAmount.toString());
    });

    it("Should fail to make bid on inactive auction", async function () {
      try {
        await marketplace.connect(addr2).makeBid(1, { value: ethers.utils.parseEther("1") });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Auction inactive");
      }
    });

    it("Should fail to finish inactive auction", async function () {
      try {
        await marketplace.finishAuction(999);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Auction inactive");
      }
    });

    it("Should fail to cancel auction with bids", async function () {
      await marketplace.connect(addr1).listItemOnAuction(1);
      await marketplace.connect(addr2).makeBid(1, { value: ethers.utils.parseEther("1") });
      
      try {
        await marketplace.connect(addr1).cancelAuction(1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Cannot cancel with bids");
      }
    });
  });

  describe("Constructor and Basic State", function () {
    it("Should set the correct NFT contract address", async function () {
      expect(await marketplace.nftContract()).to.equal(mockNFT.address);
    });

    it("Should have the correct auction duration", async function () {
      const duration = await marketplace.auctionDuration();
      expect(duration.toString()).to.equal((3 * 24 * 60 * 60).toString()); // 3 days in seconds
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple bids correctly", async function () {
      await mockNFT.connect(addr1).mint(1);
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      await marketplace.connect(addr1).createItem(1);
      await marketplace.connect(addr1).listItemOnAuction(1);

      // Place multiple bids
      await marketplace.connect(addr2).makeBid(1, { value: ethers.utils.parseEther("1") });
      await marketplace.connect(addrs[0]).makeBid(1, { value: ethers.utils.parseEther("2") });
      await marketplace.connect(addr2).makeBid(1, { value: ethers.utils.parseEther("3") });

      const auction = await marketplace.auctions(1);
      expect(auction.highestBid.toString()).to.equal(ethers.utils.parseEther("3").toString());
      expect(auction.highestBidder).to.equal(addr2.address);
      expect(auction.bidCount.toString()).to.equal("3");
    });

    it("Should not allow finishing auction with less than 2 bids", async function () {
      await mockNFT.connect(addr1).mint(1);
      await mockNFT.connect(addr1).setApprovalForAll(marketplace.address, true);
      await marketplace.connect(addr1).createItem(1);
      await marketplace.connect(addr1).listItemOnAuction(1);

      // Place single bid
      await marketplace.connect(addr2).makeBid(1, { value: ethers.utils.parseEther("1") });

      // Increase time
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Finish auction
      await marketplace.finishAuction(1);

      // NFT should still be owned by marketplace
      expect(await mockNFT.ownerOf(1)).to.equal(marketplace.address);
    });
  });
});
