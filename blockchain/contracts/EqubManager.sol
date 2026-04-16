
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ReputationSystem.sol";

contract EqubManager is Ownable {
    ReputationSystem public reputationSystem;

    struct EqubGroup {
        uint256 id;
        string name;
        uint256 contributionAmount;
        uint256 cycleDuration; // in seconds
        uint256 maxMembers;
        address[] members;
        uint256 currentCycle;
        uint256 nextCycleTime;
        bool isActive;
        mapping(address => bool) hasPaid;
        address[] payoutOrder;
        uint256 payoutIndex;
    }

    uint256 public nextGroupId;
    mapping(uint256 => EqubGroup) public groups;

    event GroupCreated(uint256 indexed id, string name, uint256 contributionAmount);
    event MemberJoined(uint256 indexed groupId, address indexed member);
    event ContributionMade(uint256 indexed groupId, address indexed member);
    event PayoutExecuted(uint256 indexed groupId, address indexed recipient, uint256 amount);

    constructor(address _reputation) Ownable(msg.sender) {
        reputationSystem = ReputationSystem(_reputation);
    }

    function createGroup(
        string memory name,
        uint256 contributionAmount,
        uint256 cycleDuration,
        uint256 maxMembers
    ) external {
        EqubGroup storage g = groups[nextGroupId];
        g.id = nextGroupId;
        g.name = name;
        g.contributionAmount = contributionAmount;
        g.cycleDuration = cycleDuration;
        g.maxMembers = maxMembers;
        g.isActive = true;
        g.nextCycleTime = block.timestamp + cycleDuration;
        
        emit GroupCreated(nextGroupId, name, contributionAmount);
        nextGroupId++;
        
        // Creator automatically joins
        _joinGroup(nextGroupId - 1, msg.sender);
    }

    function joinGroup(uint256 groupId) external {
        _joinGroup(groupId, msg.sender);
    }

    function _joinGroup(uint256 groupId, address member) internal {
        EqubGroup storage g = groups[groupId];
        require(g.isActive, "Group not active");
        require(g.members.length < g.maxMembers, "Group full");
        
        for (uint i = 0; i < g.members.length; i++) {
            require(g.members[i] != member, "Already a member");
        }

        g.members.push(member);
        g.payoutOrder.push(member); // For now, order is join order
        emit MemberJoined(groupId, member);
    }

    function contribute(uint256 groupId) external payable {
        EqubGroup storage g = groups[groupId];
        require(g.isActive, "Group not active");
        require(!g.hasPaid[msg.sender], "Already paid for this cycle");
        require(msg.value == g.contributionAmount, "Incorrect ETH amount");

        g.hasPaid[msg.sender] = true;
        
        reputationSystem.recordContribution(msg.sender, true);
        emit ContributionMade(groupId, msg.sender);

        // Check if all members have paid to execute payout
        bool allPaid = true;
        for (uint i = 0; i < g.members.length; i++) {
            if (!g.hasPaid[g.members[i]]) {
                allPaid = false;
                break;
            }
        }

        if (allPaid || block.timestamp >= g.nextCycleTime) {
            _executePayout(groupId);
        }
    }

    function _executePayout(uint256 groupId) internal {
        EqubGroup storage g = groups[groupId];
        address recipient = g.payoutOrder[g.payoutIndex];
        uint256 totalPayout = g.members.length * g.contributionAmount;

        (bool success, ) = payable(recipient).call{value: totalPayout}("");
        require(success, "Payout failed");
        
        emit PayoutExecuted(groupId, recipient, totalPayout);

        // Reset for next cycle
        for (uint i = 0; i < g.members.length; i++) {
            if (!g.hasPaid[g.members[i]]) {
                reputationSystem.recordContribution(g.members[i], false);
            }
            g.hasPaid[g.members[i]] = false;
        }

        g.payoutIndex = (g.payoutIndex + 1) % g.members.length;
        g.currentCycle += 1;
        g.nextCycleTime = block.timestamp + g.cycleDuration;
    }

    function getMembers(uint256 groupId) external view returns (address[] memory) {
        return groups[groupId].members;
    }
}
