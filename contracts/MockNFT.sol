// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// @title Mock NFT Contract for testing
// @notice This contract implements basic ERC721 functionality for testing purposes
contract MockNFT {
    mapping(uint256 => address) public ownerOf;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => address) private _tokenApprovals;
    
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // @notice Mints a new token
    // @param tokenId The ID of the token to mint
    function mint(uint256 tokenId) external {
        require(ownerOf[tokenId] == address(0), "Token already exists");
        ownerOf[tokenId] = msg.sender;
        emit Transfer(address(0), msg.sender, tokenId);
    }

    // @notice Transfers a token from one address to another
    // @param from The current owner of the token
    // @param to The new owner of the token
    // @param tokenId The ID of the token to transfer
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "Not the owner");
        require(
            msg.sender == from || 
            msg.sender == getApproved(tokenId) || 
            isApprovedForAll(from, msg.sender),
            "Not authorized"
        );
        ownerOf[tokenId] = to;
        delete _tokenApprovals[tokenId];
        emit Transfer(from, to, tokenId);
    }

    // @notice Approves an address to transfer a specific token
    // @param to Address to be approved for the given token ID
    // @param tokenId ID of the token to be approved
    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf[tokenId];
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    // @notice Gets the approved address for a token ID
    // @param tokenId ID of the token to query the approval of
    // @return Address currently approved for the given token ID
    function getApproved(uint256 tokenId) public view returns (address) {
        require(ownerOf[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }

    // @notice Sets or unsets the approval of a given operator
    // @param operator Address to add to the set of authorized operators
    // @param approved True if the operator is approved, false to revoke approval
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    // @notice Tells whether an operator is approved by a given owner
    // @param owner Owner of the token
    // @param operator Address of authorized operator
    // @return True if the operator is approved, false otherwise
    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }
}
