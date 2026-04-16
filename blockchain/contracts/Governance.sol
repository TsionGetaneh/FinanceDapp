pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ReputationSystem.sol";
contract Governance is Ownable {
    ReputationSystem public reputationSystem;

    struct Dispute {
        uint256 id;
        address creator;
        address accused;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool resolved;
        bool result;
    }

    uint256 public nextDisputeId;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event DisputeRaised(uint256 indexed id, address indexed creator, address indexed accused);
    event Voted(uint256 indexed id, address indexed voter, bool support);
    event DisputeResolved(uint256 indexed id, bool result);

    constructor(address _reputation) Ownable(msg.sender) {
        reputationSystem = ReputationSystem(_reputation);
    }

    function raiseDispute(address accused, string memory description) external {
        require(reputationSystem.getReputationScore(msg.sender) >= 500, "Insufficient reputation to raise dispute");
        
        Dispute storage d = disputes[nextDisputeId];
        d.id = nextDisputeId;
        d.creator = msg.sender;
        d.accused = accused;
        d.description = description;
        d.deadline = block.timestamp + 3 days;
        
        emit DisputeRaised(nextDisputeId, msg.sender, accused);
        nextDisputeId++;
    }

    function vote(uint256 disputeId, bool support) external {
        Dispute storage d = disputes[disputeId];
        require(!d.resolved, "Already resolved");
        require(block.timestamp < d.deadline, "Voting period ended");
        require(!hasVoted[disputeId][msg.sender], "Already voted");
        
        uint256 voterRep = reputationSystem.getReputationScore(msg.sender);
        require(voterRep >= 400, "Reputation too low to vote");

        if (support) {
            d.votesFor += voterRep;
        } else {
            d.votesAgainst += voterRep;
        }

        hasVoted[disputeId][msg.sender] = true;
        emit Voted(disputeId, msg.sender, support);
    }

    function resolveDispute(uint256 disputeId) external {
        Dispute storage d = disputes[disputeId];
        require(!d.resolved, "Already resolved");
        require(block.timestamp >= d.deadline, "Voting period not ended");

        d.resolved = true;
        d.result = d.votesFor > d.votesAgainst;

        if (d.result) {
            // Accused is found guilty, slash reputation
            // In a real system, you'd call recordLoanRepayment with success=false or similar
            reputationSystem.recordLoanRepayment(d.accused, false);
        }

        emit DisputeResolved(disputeId, d.result);
    }
}
