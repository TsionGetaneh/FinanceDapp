pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ReputationSystem.sol";

contract LendingPool is Ownable {
    ReputationSystem public reputationSystem;

    struct Loan {
        uint256 id;
        address borrower;
        uint256 amount;
        uint256 interestRate; // percentage
        uint256 dueDate;
        bool isRepaid;
        bool isDefaulted;
        address[] cosigners;
        uint256 approvals;
    }

    uint256 public nextLoanId;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    event LoanRequested(uint256 indexed id, address indexed borrower, uint256 amount);
    event LoanApproved(uint256 indexed id, address indexed cosigner);
    event LoanIssued(uint256 indexed id, address indexed borrower, uint256 amount);
    event LoanRepaid(uint256 indexed id, address indexed borrower, uint256 amount);

    constructor(address _reputation) Ownable(msg.sender) {
        reputationSystem = ReputationSystem(_reputation);
    }

    // Function to fund the pool with ETH
    receive() external payable {}

    function requestLoan(uint256 amount, uint256 duration, address[] memory requestedCosigners) external {
        require(reputationSystem.getReputationScore(msg.sender) >= 600, "Reputation too low");
        require(requestedCosigners.length >= 2, "At least 2 cosigners required");

        Loan storage l = loans[nextLoanId];
        l.id = nextLoanId;
        l.borrower = msg.sender;
        l.amount = amount;
        l.interestRate = 5; // Fixed 5% interest
        l.dueDate = block.timestamp + duration;
        l.cosigners = requestedCosigners;
        
        emit LoanRequested(nextLoanId, msg.sender, amount);
        nextLoanId++;
    }

    function approveLoan(uint256 loanId) external {
        Loan storage l = loans[loanId];
        require(!l.isRepaid && !l.isDefaulted, "Loan already finalized");
        require(!hasApproved[loanId][msg.sender], "Already approved");

        bool isCosigner = false;
        for (uint i = 0; i < l.cosigners.length; i++) {
            if (l.cosigners[i] == msg.sender) {
                isCosigner = true;
                break;
            }
        }
        require(isCosigner, "Not a cosigner");

        hasApproved[loanId][msg.sender] = true;
        l.approvals += 1;
        emit LoanApproved(loanId, msg.sender);

        if (l.approvals >= 2) {
            _issueLoan(loanId);
        }
    }

    function _issueLoan(uint256 loanId) internal {
        Loan storage l = loans[loanId];
        require(address(this).balance >= l.amount, "Insufficient pool funds");
        
        (bool success, ) = payable(l.borrower).call{value: l.amount}("");
        require(success, "Loan transfer failed");
        
        emit LoanIssued(loanId, l.borrower, l.amount);
    }

    function repayLoan(uint256 loanId) external payable {
        Loan storage l = loans[loanId];
        require(msg.sender == l.borrower, "Not the borrower");
        require(!l.isRepaid, "Already repaid");

        uint256 totalRepayment = l.amount + (l.amount * l.interestRate / 100);
        require(msg.value == totalRepayment, "Incorrect repayment amount");
        
        l.isRepaid = true;
        reputationSystem.recordLoanRepayment(msg.sender, true);
        emit LoanRepaid(loanId, msg.sender, totalRepayment);
    }

    function checkDefault(uint256 loanId) external {
        Loan storage l = loans[loanId];
        if (!l.isRepaid && !l.isDefaulted && block.timestamp > l.dueDate) {
            l.isDefaulted = true;
            reputationSystem.recordLoanRepayment(l.borrower, false);
            // In a real system, you might also affect cosigner reputation here
        }
    }
}
