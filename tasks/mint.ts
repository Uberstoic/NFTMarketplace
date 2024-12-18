import { task } from "hardhat/config";
import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("mint", "Mints a new NFT token")
  .addParam("contract", "The NFT contract address")
  .addParam("to", "The recipient address")
  .addParam("tokenId", "The token ID to mint")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { contract: contractAddress, to: recipient, tokenId } = taskArgs;

    // Get the contract factory and attach to the deployed contract
    const MockNFT = await hre.ethers.getContractFactory("MockNFT");
    const nftContract = MockNFT.attach(contractAddress) as Contract;

    console.log(`Minting NFT with ID ${tokenId} to address ${recipient}...`);

    try {
      // Mint the NFT
      const tx = await nftContract.mint(recipient, tokenId);
      await tx.wait();

      console.log(`Successfully minted NFT!`);
      console.log(`Transaction hash: ${tx.hash}`);
      
      // Get the owner of the newly minted token to verify
      const owner = await nftContract.ownerOf(tokenId);
      console.log(`Token ${tokenId} is now owned by: ${owner}`);
    } catch (error) {
      console.error("Error minting NFT:", error);
      throw error;
    }
  });
