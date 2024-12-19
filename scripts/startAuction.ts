import { ethers } from "ethers";
import marketplaceABI from "../artifacts/contracts/Marketplace.sol/Marketplace.json";

// Configuration
const provider = new ethers.providers.JsonRpcProvider("<RPC_URL>");
const signer = provider.getSigner(); // Use your wallet to sign transactions
const marketplaceAddress = "<MARKETPLACE_CONTRACT_ADDRESS>";
const marketplace = new ethers.Contract(marketplaceAddress, marketplaceABI.abi, signer);

// Start auction function
async function startAuction(tokenId: number) {
  try {
    const tx = await marketplace.listItemOnAuction(tokenId);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Auction started:", receipt);
  } catch (error) {
    console.error("Error starting auction:", error);
  }
}

// Example usage
startAuction(1); // Replace with the token ID you want to auction
