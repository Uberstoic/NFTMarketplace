import { ethers } from "hardhat";

async function main() {
  const MockNFT = await ethers.getContractFactory("MockNFT");
  const nft = await MockNFT.deploy();
  await nft.deployed();

  console.log("NFT deployed to:", nft.address);

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy();
  await marketplace.deployed();

  console.log("Marketplace deployed to:", marketplace.address);

  // Set up contracts
  console.log("Setting up contract relationships...");
  
  const setNFTTx = await marketplace.setNFTContract(nft.address);
  await setNFTTx.wait();
  console.log("NFT contract set in Marketplace");
  
  const setMarketplaceTx = await nft.setMarketplace(marketplace.address);
  await setMarketplaceTx.wait();
  console.log("Marketplace set in NFT contract");

  console.log("Deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
