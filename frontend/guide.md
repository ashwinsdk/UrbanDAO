# UrbanDAO Frontend Testing Guide

## Overview
This guide will help you test all the functionality of the UrbanDAO frontend application with real Solana blockchain integration. The application is now fully integrated with the Anchor backend and ready for testing on Solana Devnet.

## Prerequisites

### 1. Install Phantom Wallet
- Install the [Phantom Wallet](https://phantom.app/) browser extension
- Create a new wallet or import an existing one
- Switch to **Devnet** in Phantom settings:
  - Click the gear icon in Phantom
  - Go to "Developer Settings"
  - Change network to "Devnet"

### 2. Get Devnet SOL
- Visit [Solana Faucet](https://faucet.solana.com/)
- Enter your Phantom wallet address
- Request 2 SOL (you'll need this for transactions)

### 3. Start the Application
```bash
cd /Users/ashwinsudhakar/Documents/Code/Projects/IEEE/UrbanDAO/frontend
npm start
```
The application will be available at `http://localhost:4200`

## Testing Workflow

### Phase 1: Initial Setup and Registration

#### 1.1 Connect Phantom Wallet
1. Open `http://localhost:4200` in your browser
2. Click **"Connect Wallet"** button
3. Phantom should prompt you to connect - approve the connection
4. You should see your wallet address displayed

#### 1.2 Register as Different User Types
You'll need to test all three user roles. For comprehensive testing, use different wallet addresses:

**Test Registration for Citizen:**
1. Click **"Register"** button
2. Fill out the registration form:
   - Name: "Test Citizen"
   - Email: "citizen@test.com"
   - Phone: "1234567890"
   - Address: "123 Test Street"
   - Ward: "1"
   - Role: Select "Citizen"
3. Click **"Register"** - this will create a real blockchain transaction
4. Wait for transaction confirmation
5. You should be redirected to the Citizen dashboard

**Test Registration for Admin Head:**
1. Use a different wallet address (create new account in Phantom)
2. Repeat registration process with Role: "Admin Head"
3. Department: "Public Works"

**Test Registration for Government Admin:**
1. Use a third wallet address
2. Repeat registration process with Role: "Government Admin"
3. Department: "Municipal Corporation"

### Phase 2: Citizen Functionality Testing

#### 2.1 File Grievances
1. Navigate to **"File Grievance"** from citizen dashboard
2. Fill out the grievance form:
   - Category: "Road Maintenance"
   - Description: "Pothole on Main Street needs repair"
   - Location: "Main Street, Ward 1"
3. Submit the grievance - this creates a real blockchain transaction
4. Check transaction in Phantom wallet history
5. Navigate to **"My Grievances"** to see submitted grievance

#### 2.2 Pay Taxes
1. Navigate to **"Pay Tax"** from citizen dashboard
2. Enter tax details:
   - Ward: "1"
   - Year: "2024"
   - Amount: "100" (in SOL)
3. Submit payment - this creates a real blockchain transaction
4. Check **"Tax Status"** to see payment history

#### 2.3 Submit Feedback
1. Navigate to **"Give Feedback"**
2. Select a project from the dropdown
3. Provide feedback:
   - Comment: "Great progress on the road repair project"
   - Satisfaction: Select "Satisfied"
4. Submit feedback - creates blockchain transaction

#### 2.4 View Projects
1. Navigate to **"View Projects"**
2. Browse available projects
3. Use search functionality to filter projects
4. Click on projects to view details

### Phase 3: Admin Head Functionality Testing

Switch to the Admin Head wallet account:

#### 3.1 Manage Grievances
1. Navigate to **"Manage Grievances"**
2. View all submitted grievances
3. Click on a grievance to view details
4. Update grievance status:
   - Change status from "Pending" to "In Progress"
   - Add response: "We have assigned a team to investigate"
5. Submit update - creates blockchain transaction

#### 3.2 Manage Projects
1. Navigate to **"Manage Projects"**
2. Create a new project:
   - Name: "Road Repair Project"
   - Description: "Repair potholes on Main Street"
   - Budget: "1000"
   - Ward: "1"
   - Location: "Main Street"
3. Submit project creation - creates blockchain transaction
4. Update existing project status from "Planning" to "Ongoing"

### Phase 4: Government Admin Functionality Testing

Switch to the Government Admin wallet account:

#### 4.1 Assign Admin Head
1. Navigate to **"Assign Head"**
2. Enter the wallet address of your Admin Head account
3. Submit assignment - creates blockchain transaction

#### 4.2 Set Ward Tax
1. Navigate to **"Set Tax"**
2. Configure tax for a ward:
   - Ward: "1"
   - Tax Amount: "100"
   - Year: "2024"
3. Submit tax configuration - creates blockchain transaction

#### 4.3 View All Data
1. Navigate to **"View Projects"** to see all projects across wards
2. Navigate to **"View Grievances"** to see all grievances
3. Use admin dashboard to monitor overall system activity

### Phase 5: Cross-Role Integration Testing

#### 5.1 End-to-End Workflow Test
1. **Government Admin**: Set ward tax for Ward 1
2. **Citizen**: Pay the tax for Ward 1
3. **Citizen**: File a grievance about road conditions
4. **Admin Head**: Review and update grievance status
5. **Admin Head**: Create a project to address the grievance
6. **Citizen**: View the project and provide feedback
7. **Admin Head**: Update project status to completed

#### 5.2 Real-Time Updates Test
1. Have multiple browser windows open with different user roles
2. Perform actions in one window
3. Refresh other windows to see updates
4. Verify blockchain state consistency across all roles

## Verification Points

### Blockchain Integration Verification
- [ ] All transactions appear in Phantom wallet history
- [ ] Transaction signatures are displayed in the UI
- [ ] Data persists after browser refresh (stored on blockchain)
- [ ] No mock data is displayed anywhere
- [ ] Error handling works for failed transactions

### User Experience Verification
- [ ] Wallet connection/disconnection works smoothly
- [ ] Role-based navigation is correct
- [ ] Forms validate input properly
- [ ] Loading states are shown during transactions
- [ ] Success/error messages are displayed appropriately

### Data Consistency Verification
- [ ] Grievances filed by citizens appear in Admin Head dashboard
- [ ] Projects created by Admin Head appear in citizen project view
- [ ] Tax payments are reflected in citizen tax status
- [ ] Feedback submitted by citizens is visible to Admin Head

## Troubleshooting

### Common Issues and Solutions

**Wallet Connection Issues:**
- Ensure Phantom is installed and unlocked
- Check that you're on Devnet network
- Try refreshing the page and reconnecting

**Transaction Failures:**
- Ensure you have sufficient SOL in your wallet (at least 0.01 SOL)
- Check that you're on the correct network (Devnet)
- Wait for previous transactions to confirm before submitting new ones

**Data Not Appearing:**
- Wait a few seconds for blockchain confirmation
- Refresh the page to reload data from blockchain
- Check browser console for any error messages

**Role Access Issues:**
- Ensure you've registered with the correct role
- Try disconnecting and reconnecting your wallet
- Check that registration transaction was confirmed

## Advanced Testing

### Performance Testing
1. Submit multiple transactions in quick succession
2. Test with large amounts of data (many grievances, projects)
3. Test concurrent users (multiple browser windows)

### Security Testing
1. Try accessing admin functions with citizen account
2. Test wallet disconnection during transactions
3. Verify that only authorized users can perform specific actions

### Network Testing
1. Test with slow network connections
2. Test transaction failures and retries
3. Test switching between different Solana networks

## Expected Behavior

### Successful Integration Indicators
- ✅ No mock data anywhere in the application
- ✅ All user actions create real blockchain transactions
- ✅ Data persists across browser sessions
- ✅ Role-based access control works correctly
- ✅ Real-time blockchain state updates
- ✅ Proper error handling for blockchain failures

### Transaction Flow
1. User initiates action (file grievance, pay tax, etc.)
2. Frontend creates transaction using Anchor program
3. Phantom wallet prompts for approval
4. User approves transaction
5. Transaction is submitted to Solana blockchain
6. Frontend waits for confirmation
7. UI updates with transaction result
8. Data is permanently stored on blockchain

## Support

If you encounter any issues during testing:

1. Check the browser console for error messages
2. Verify your Phantom wallet settings and balance
3. Ensure you're connected to Solana Devnet
4. Try refreshing the page and reconnecting wallet

The application is now fully integrated with real Solana blockchain functionality and ready for comprehensive testing!

## Summary

This UrbanDAO application now features:
- ✅ Complete removal of all mock data and implementations
- ✅ Real Solana Anchor blockchain integration
- ✅ Three distinct user roles with proper access control
- ✅ End-to-end transaction workflows
- ✅ Persistent data storage on Solana blockchain
- ✅ Production-ready code with proper error handling

Happy testing! 🚀
