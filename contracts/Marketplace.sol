// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

// @title NFT Marketplace with auction functionality
// @notice This contract implements a marketplace for NFTs with direct sale and auction features
contract Marketplace {
    IERC721 public nftContract;
    uint256 public auctionDuration = 3 days;

    struct Auction {
        address seller;
        uint256 tokenId;
        uint256 highestBid;
        address highestBidder;
        uint256 startTime;
        bool active;
        uint256 bidCount;
    }

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => address) public itemOwners;
    mapping(uint256 => uint256) public itemPrices;

    event ItemCreated(address indexed owner, uint256 tokenId);
    event ItemListed(uint256 tokenId, uint256 price);
    event ItemSold(address buyer, uint256 tokenId, uint256 price);
    event ItemCanceled(uint256 tokenId);
    event AuctionStarted(uint256 tokenId, uint256 startTime);
    event BidPlaced(address bidder, uint256 tokenId, uint256 bid);
    event AuctionFinished(uint256 tokenId, address winner, uint256 amount);
    event AuctionCanceled(uint256 tokenId);

    constructor(address _nftContract) {
        nftContract = IERC721(_nftContract);
    }

    // @notice Creates a new item in the marketplace
    // @param tokenId The ID of the NFT to be created
    function createItem(uint256 tokenId) external {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        itemOwners[tokenId] = msg.sender;
        emit ItemCreated(msg.sender, tokenId);
    }

    // @notice Lists an item for direct sale
    // @param tokenId The ID of the NFT to be listed
    // @param price The price in ETH for the NFT
    function listItem(uint256 tokenId, uint256 price) external {
        require(itemOwners[tokenId] == msg.sender, "Not owner");
        require(price > 0, "Price must be greater than 0");
        itemPrices[tokenId] = price;
        emit ItemListed(tokenId, price);
    }

    // @notice Cancels a listed item
    // @param tokenId The ID of the NFT to be canceled
    function cancel(uint256 tokenId) external {
        require(itemOwners[tokenId] == msg.sender, "Not owner");
        require(itemPrices[tokenId] > 0, "Item not listed");
        delete itemPrices[tokenId];
        emit ItemCanceled(tokenId);
    }

    // @notice Allows a user to buy a listed item
    // @param tokenId The ID of the NFT to be purchased
    function buyItem(uint256 tokenId) external payable {
        uint256 price = itemPrices[tokenId];
        require(price > 0, "Item not for sale");
        require(msg.value >= price, "Insufficient payment");

        address seller = itemOwners[tokenId];
        itemOwners[tokenId] = msg.sender;
        delete itemPrices[tokenId];

        nftContract.transferFrom(address(this), msg.sender, tokenId);
        payable(seller).transfer(msg.value);
        emit ItemSold(msg.sender, tokenId, price);
    }

    // @notice Lists an item for auction
    // @param tokenId The ID of the NFT to be auctioned
    function listItemOnAuction(uint256 tokenId) external {
        require(itemOwners[tokenId] == msg.sender, "Not owner");
        require(!auctions[tokenId].active, "Auction already active");

        auctions[tokenId] = Auction({
            seller: msg.sender,
            tokenId: tokenId,
            highestBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            active: true,
            bidCount: 0
        });
        emit AuctionStarted(tokenId, block.timestamp);
    }

    // @notice Places a bid on an active auction
    // @param tokenId The ID of the NFT being auctioned
    function makeBid(uint256 tokenId) external payable {
        Auction storage auction = auctions[tokenId];
        require(auction.active, "Auction inactive");
        require(block.timestamp <= auction.startTime + auctionDuration, "Auction ended");
        require(msg.value > auction.highestBid, "Bid too low");

        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;
        auction.bidCount++;
        emit BidPlaced(msg.sender, tokenId, msg.value);
    }

    // @notice Finishes an auction after its duration has passed
    // @param tokenId The ID of the NFT being auctioned
    function finishAuction(uint256 tokenId) external {
        Auction storage auction = auctions[tokenId];
        require(auction.active, "Auction inactive");
        require(block.timestamp >= auction.startTime + auctionDuration, "Auction not over");

        auction.active = false;

        if (auction.bidCount >= 2) {
            nftContract.transferFrom(address(this), auction.highestBidder, tokenId);
            payable(auction.seller).transfer(auction.highestBid);
            emit AuctionFinished(tokenId, auction.highestBidder, auction.highestBid);
        } else {
            // Return NFT to seller, refund the last bid
            if (auction.highestBidder != address(0)) {
                payable(auction.highestBidder).transfer(auction.highestBid);
            }
            emit AuctionFinished(tokenId, address(0), 0);
        }
    }

    // @notice Cancels an auction if no bids have been placed
    // @param tokenId The ID of the NFT being auctioned
    function cancelAuction(uint256 tokenId) external {
        Auction storage auction = auctions[tokenId];
        require(auction.seller == msg.sender, "Not auction creator");
        require(block.timestamp < auction.startTime + auctionDuration, "Auction ended");
        require(auction.bidCount == 0, "Cannot cancel with bids");

        auction.active = false;
        emit AuctionCanceled(tokenId);
    }
}
