
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ReputationSystem is Ownable {
    struct Score {
        uint256 totalContributions;
        uint256 missedContributions;
        uint256 totalLoansRepaid;
        uint256 totalLoansDefaulted;
        uint256 lastUpdated;
    }

    mapping(address => Score) public userScores;
    mapping(address => bool) public authorizedCallers;
    mapping(address => mapping(address => bool)) public vouches;
    mapping(address => uint256) public vouchCount;

    event Vouched(address indexed voucher, address indexed vouched);
    event ScoreUpdated(address indexed user, uint256 newScore);

    function vouch(address user) external {
        require(user != msg.sender, "Cannot vouch for yourself");
        require(!vouches[msg.sender][user], "Already vouched for this user");
        require(getReputationScore(msg.sender) >= 500, "Need 500+ reputation to vouch");

        vouches[msg.sender][user] = true;
        vouchCount[user] += 1;
        
        // Vouching gives a small boost
        userScores[user].totalContributions += 1; 
        
        emit Vouched(msg.sender, user);
    }

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setAuthorizedCaller(address caller, bool status) external onlyOwner {
        authorizedCallers[caller] = status;
    }

    function recordContribution(address user, bool success) external onlyAuthorized {
        if (success) {
            userScores[user].totalContributions += 1;
        } else {
            userScores[user].missedContributions += 1;
        }
        userScores[user].lastUpdated = block.timestamp;
        emit ScoreUpdated(user, getReputationScore(user));
    }

    function recordLoanRepayment(address user, bool success) external onlyAuthorized {
        if (success) {
            userScores[user].totalLoansRepaid += 1;
        } else {
            userScores[user].totalLoansDefaulted += 1;
        }
        userScores[user].lastUpdated = block.timestamp;
        emit ScoreUpdated(user, getReputationScore(user));
    }

    function getReputationScore(address user) public view returns (uint256) {
        Score storage s = userScores[user];
        uint256 baseScore = 500; // Start at 500 (out of 1000)
        
        // Contributions: +10 for each, -50 for missed
        int256 contributionImpact = (int256(s.totalContributions) * 10) - (int256(s.missedContributions) * 50);
        
        // Loans: +50 for each repaid, -200 for defaulted
        int256 loanImpact = (int256(s.totalLoansRepaid) * 50) - (int256(s.totalLoansDefaulted) * 200);
        
        int256 finalScore = int256(baseScore) + contributionImpact + loanImpact;
        
        if (finalScore < 0) return 0;
        if (finalScore > 1000) return 1000;
        return uint256(finalScore);
    }
}
