
import { ethers } from "ethers";
import marketplaceABI from "../artifacts/contracts/Marketplace.sol/Marketplace.json";

// Configuration
const provider = new ethers.providers.JsonRpcProvider("<RPC_URL>");
const signer = provider.getSigner(); // Use your wallet to sign transactions
const marketplaceAddress = "<MARKETPLACE_CONTRACT_ADDRESS>";
const marketplace = new ethers.Contract(marketplaceAddress, marketplaceABI.abi, signer);

// Place bid function
async function placeBid(tokenId: number, bidAmount: string) {
  try {
    const tx = await marketplace.makeBid(tokenId, {
      value: ethers.utils.parseEther(bidAmount), // Set bid amount in ETH
    });
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Bid placed:", receipt);
  } catch (error) {
    console.error("Error placing bid:", error);
  }
}

// Example usage
placeBid(1, "0.1"); // Replace with the token ID and bid amount
