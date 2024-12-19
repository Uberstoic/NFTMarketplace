
import { ethers } from "ethers";
import marketplaceABI from "../artifacts/contracts/Marketplace.sol/Marketplace.json"; 

// Configuration
const provider = new ethers.providers.JsonRpcProvider("<RPC_URL>");
const signer = provider.getSigner(); // Use your wallet to sign transactions
const marketplaceAddress = "<MARKETPLACE_CONTRACT_ADDRESS>";
const marketplace = new ethers.Contract(marketplaceAddress, marketplaceABI.abi, signer);

// Cancel auction function
async function cancelAuction(tokenId: number) {
  try {
    const tx = await marketplace.cancelAuction(tokenId);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Auction canceled:", receipt);
  } catch (error) {
    console.error("Error canceling auction:", error);
  }
}

// Example usage
cancelAuction(1); // Replace with the token ID of the auction to cancel
