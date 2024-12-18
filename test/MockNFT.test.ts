import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockNFT } from "../typechain-types";
import "@nomicfoundation/hardhat-chai-matchers";

describe("MockNFT", function () {
  let mockNFT: MockNFT;
  let owner: SignerWithAddress;
  let marketplace: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  beforeEach(async function () {
    [owner, marketplace, addr1, addr2, ...addrs] = await ethers.getSigners();
    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();
    await mockNFT.setMarketplace(marketplace.address);
  });

  describe("Deployment", function () {
    it("Should set the correct marketplace address", async function () {
      expect(await mockNFT.marketplace()).to.equal(marketplace.address);
    });
  });

  describe("Marketplace Management", function () {
    it("Should not allow setting marketplace address twice", async function () {
      await expect(mockNFT.setMarketplace(addr1.address))
        .to.be.revertedWith("Marketplace already set");
    });

    it("Should not allow setting marketplace to zero address", async function () {
      const newNFT = await (await ethers.getContractFactory("MockNFT")).deploy();
      await expect(newNFT.setMarketplace(ethers.constants.AddressZero))
        .to.be.revertedWith("Invalid marketplace address");
    });
  });

  describe("Minting", function () {
    it("Should allow marketplace to mint a new token", async function () {
      await mockNFT.connect(marketplace).mint(addr1.address, 1);
      expect(await mockNFT.ownerOf(1)).to.equal(addr1.address);
    });

    it("Should emit Transfer event on mint", async function () {
      await expect(mockNFT.connect(marketplace).mint(addr1.address, 1))
        .to.emit(mockNFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, addr1.address, 1);
    });

    it("Should fail if non-marketplace address tries to mint", async function () {
      await expect(mockNFT.connect(addr1).mint(addr1.address, 1))
        .to.be.revertedWith("Only marketplace can call this");
    });

    it("Should fail minting existing token", async function () {
      await mockNFT.connect(marketplace).mint(addr1.address, 1);
      await expect(mockNFT.connect(marketplace).mint(addr2.address, 1))
        .to.be.revertedWith("Token already exists");
    });
  });

  describe("Token Transfers", function () {
    beforeEach(async function () {
      await mockNFT.connect(marketplace).mint(addr1.address, 1);
    });

    it("Should transfer token between accounts", async function () {
      await mockNFT.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
      expect(await mockNFT.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should emit Transfer event on transfer", async function () {
      await expect(mockNFT.connect(addr1).transferFrom(addr1.address, addr2.address, 1))
        .to.emit(mockNFT, "Transfer")
        .withArgs(addr1.address, addr2.address, 1);
    });

    it("Should fail if sender is not owner", async function () {
      await expect(mockNFT.connect(addr2).transferFrom(addr1.address, addr2.address, 1))
        .to.be.revertedWith("Not authorized");
    });

    it("Should fail if token doesn't exist", async function () {
      await expect(mockNFT.connect(addr1).transferFrom(addr1.address, addr2.address, 999))
        .to.be.revertedWith("Not the owner");
    });

    it("Should allow approved address to transfer", async function () {
      await mockNFT.connect(addr1).approve(addr2.address, 1);
      await mockNFT.connect(addr2).transferFrom(addr1.address, addr2.address, 1);
      expect(await mockNFT.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should clear approval after transfer", async function () {
      await mockNFT.connect(addr1).approve(addr2.address, 1);
      await mockNFT.connect(addr2).transferFrom(addr1.address, addr2.address, 1);
      expect(await mockNFT.getApproved(1)).to.equal(ethers.constants.AddressZero);
    });
  });

  describe("Approvals", function () {
    beforeEach(async function () {
      await mockNFT.connect(marketplace).mint(addr1.address, 1);
    });

    it("Should approve address for token", async function () {
      await mockNFT.connect(addr1).approve(addr2.address, 1);
      expect(await mockNFT.getApproved(1)).to.equal(addr2.address);
    });

    it("Should emit Approval event", async function () {
      await expect(mockNFT.connect(addr1).approve(addr2.address, 1))
        .to.emit(mockNFT, "Approval")
        .withArgs(addr1.address, addr2.address, 1);
    });

    it("Should fail approving if not owner", async function () {
      await expect(mockNFT.connect(addr2).approve(addr2.address, 1))
        .to.be.revertedWith("Not authorized");
    });

    it("Should fail getting approval for non-existent token", async function () {
      await expect(mockNFT.getApproved(999))
        .to.be.revertedWith("Token does not exist");
    });
  });

  describe("Operator Approvals", function () {
    beforeEach(async function () {
      await mockNFT.connect(marketplace).mint(addr1.address, 1);
    });

    it("Should set approval for all", async function () {
      await mockNFT.connect(addr1).setApprovalForAll(addr2.address, true);
      expect(await mockNFT.isApprovedForAll(addr1.address, addr2.address)).to.be.true;
    });

    it("Should emit ApprovalForAll event", async function () {
      await expect(mockNFT.connect(addr1).setApprovalForAll(addr2.address, true))
        .to.emit(mockNFT, "ApprovalForAll")
        .withArgs(addr1.address, addr2.address, true);
    });

    it("Should allow operator to transfer", async function () {
      await mockNFT.connect(addr1).setApprovalForAll(addr2.address, true);
      await mockNFT.connect(addr2).transferFrom(addr1.address, addr2.address, 1);
      expect(await mockNFT.ownerOf(1)).to.equal(addr2.address);
    });
  });
});
