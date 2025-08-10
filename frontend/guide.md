# UrbanDAO Frontend - Complete Testing & Usage Guide

This comprehensive guide provides step-by-step instructions for testing and using the fully integrated UrbanDAO frontend application with **real Solana blockchain integration**. All mock data has been removed and replaced with actual Anchor program calls.

## 🚀 Quick Start

### Prerequisites
- **Phantom Wallet**: [Install browser extension](https://phantom.app/)
- **Node.js 18+** and **Angular CLI**: `npm install -g @angular/cli`
- **Devnet SOL**: Get from [Solana Faucet](https://faucet.solana.com/)

### Launch Application
```bash
cd frontend
npm install  # if not already done
ng serve
```
**Access**: http://localhost:4200

---

## 🔧 Initial Setup

### 1. Phantom Wallet Configuration
1. Install Phantom wallet browser extension
2. Create new wallet or import existing
3. **Critical**: Switch to **Solana Devnet** in settings
4. Fund wallet with devnet SOL (minimum 1 SOL recommended)

### 2. First-Time Connection
1. Navigate to http://localhost:4200
2. Click "Connect Wallet" 
3. Approve Phantom connection
4. Verify network shows "Devnet" in wallet

---

## 👥 User Roles & Registration

### Role-Based Access System
The UrbanDAO supports three distinct user roles, each with specific permissions and workflows:

#### **🏠 Citizen Role**
- File grievances about civic issues
- Pay annual ward taxes
- Submit feedback on projects
- View personal status and history

#### **👨‍💼 Admin Head Role** 
- Manage and update grievance status
- Create and manage civic projects
- Update project progress status
- Oversee ward-level operations

#### **🏛️ Government Admin Role**
- Assign new admin heads
- Set ward tax rates
- View comprehensive reports
- Manage system-wide settings

### Registration Process
1. **Connect Wallet**: Click "Connect Wallet" on homepage
2. **Select Role**: Choose your role from registration form
3. **Fill Details**: Complete required information
4. **Submit**: Transaction creates your PDA account on blockchain
5. **Confirmation**: Receive transaction signature and role-based redirect

---

## 🧪 Complete Testing Scenarios

### 📋 Scenario 1: Citizen User Journey

#### **Step 1: Registration**
```
Actions:
1. Navigate to homepage
2. Click "Connect Wallet" → Approve Phantom
3. Click "Register" → Select "Citizen"
4. Fill form: Name, Ward, Contact details
5. Submit registration

Expected Results:
✅ Transaction signature in console
✅ PDA account created on blockchain  
✅ Redirect to citizen dashboard
✅ Role-specific navigation menu appears
```

#### **Step 2: File a Grievance**
```
Actions:
1. Navigate to "File Grievance"
2. Complete form:
   - Category: Road Maintenance/Water Supply/etc.
   - Ward: Select from dropdown
   - Location: Specific address/area
   - Description: Detailed issue (min 20 chars)
3. Click "Submit Grievance"

Expected Results:
✅ Real Anchor program call: fileGrievance()
✅ Transaction signature logged
✅ Success message with transaction ID
✅ Automatic redirect to status page
✅ Grievance appears in blockchain data
```

#### **Step 3: Pay Ward Tax**
```
Actions:
1. Navigate to "Pay Tax"
2. View current tax due amount
3. Click "Confirm Payment"
4. Approve SOL transfer in Phantom

Expected Results:
✅ Real SOL transfer from wallet to treasury
✅ payTax() Anchor method executed
✅ Payment recorded on blockchain
✅ Tax status updated to "Paid"
✅ Transaction visible in Phantom history
```

#### **Step 4: Submit Project Feedback**
```
Actions:
1. Navigate to "Feedback"
2. Fill feedback form:
   - Category: Select feedback type
   - Rating: 1-5 stars
   - Comments: Detailed feedback
3. Submit feedback

Expected Results:
✅ giveFeedback() Anchor method called
✅ Feedback stored on blockchain
✅ Transaction confirmation received
✅ Form reset after success
```

#### **Step 5: Check Status Dashboard**
```
Actions:
1. Navigate to "Status"
2. Switch between tabs:
   - Grievances: View filed grievances
   - Payments: See tax payment history  
   - Feedback: Review submitted feedback
3. Use search/filter options

Expected Results:
✅ Real blockchain data fetched
✅ No mock data present
✅ Live status updates
✅ Transaction IDs for all actions
✅ Proper filtering and search
```

### 👨‍💼 Scenario 2: Admin Head User Journey

#### **Step 1: Admin Head Registration**
```
Actions:
1. Register as "Admin Head" (similar to citizen)
2. Access admin head dashboard

Expected Results:
✅ Admin head PDA created
✅ Access to admin-specific features
✅ Different navigation menu
```

#### **Step 2: Grievance Management**
```
Actions:
1. Navigate to "Grievances"
2. View list of all grievances from blockchain
3. Click on specific grievance
4. Update status: Pending → In Progress → Resolved
5. Add response comments

Expected Results:
✅ Real grievance data from blockchain
✅ updateGrievanceStatus() Anchor calls
✅ Status changes recorded on-chain
✅ Citizens see updated status immediately
```

#### **Step 3: Project Management**
```
Actions:
1. Navigate to "Projects"
2. Click "Create New Project"
3. Fill project details:
   - Name: Project title
   - Description: Detailed description
4. Submit project creation
5. Update project status as work progresses

Expected Results:
✅ createProject() Anchor method executed
✅ Project stored on blockchain
✅ updateProjectStatus() for status changes
✅ Citizens can view and provide feedback
```

### 🏛️ Scenario 3: Government Admin User Journey

#### **Step 1: Government Admin Registration**
```
Actions:
1. Register as "Government Admin"
2. Access government dashboard

Expected Results:
✅ Government admin PDA created
✅ Access to system-wide controls
✅ Administrative navigation menu
```

#### **Step 2: Assign Admin Head**
```
Actions:
1. Navigate to "Assign Head"
2. Enter new admin head wallet address
3. Provide name and contact details
4. Submit assignment

Expected Results:
✅ assignAdminHead() Anchor method called
✅ New admin head authorized on blockchain
✅ Admin head can now access admin features
```

#### **Step 3: Set Ward Tax Rates**
```
Actions:
1. Navigate to "Set Tax"
2. Select ward from dropdown
3. Enter tax amount in SOL
4. Submit tax rate update

Expected Results:
✅ setWardTax() Anchor method executed
✅ Ward tax rate updated on blockchain
✅ Citizens see new tax amounts
✅ Tax payments use updated rates
```

#### **Step 4: System Overview**
```
Actions:
1. Navigate to "View Grievances" - see all grievances
2. Navigate to "View Projects" - see all projects
3. Monitor system-wide activity

Expected Results:
✅ Comprehensive blockchain data view
✅ Real-time updates from all users
✅ Complete audit trail of all actions
```

---

## 🔍 Blockchain Verification

### Transaction Verification
1. **Console Monitoring**: Check browser console for transaction signatures
2. **Solana Explorer**: Visit [explorer.solana.com](https://explorer.solana.com/?cluster=devnet)
3. **Search Transactions**: Paste transaction signatures to verify on-chain execution
4. **Account Inspection**: View PDA accounts and their data

### Real Integration Verification
```javascript
// Example console output for successful operations:
"Grievance submitted successfully. Transaction: 2Z8f7Kx..."
"Tax payment successful. Transaction: 4A9m3Nq..."
"Project created successfully. Transaction: 7B2k5Wp..."
```

### PDA Account Verification
- **Citizen PDA**: `[program_id, "citizen", wallet_address]`
- **Admin Head PDA**: `[program_id, "admin_head", wallet_address]`
- **Government PDA**: `[program_id, "government", wallet_address]`

---

## ⚠️ Troubleshooting Guide

### Common Issues & Solutions

#### **Wallet Connection Problems**
```
Problem: Phantom wallet not connecting
Solutions:
✅ Refresh page and retry
✅ Ensure Phantom is unlocked
✅ Verify network is set to Devnet
✅ Clear browser cache if needed
```

#### **Transaction Failures**
```
Problem: Transactions failing or timing out
Solutions:
✅ Check sufficient SOL balance (>0.01 SOL for fees)
✅ Confirm correct network (Devnet)
✅ Wait for network congestion to clear
✅ Try smaller transaction amounts
```

#### **Build Warnings (Expected)**
```
Expected Warnings:
⚠️ CSS budget exceeded - doesn't affect functionality
⚠️ CommonJS dependencies - normal for Solana libraries
⚠️ Bundle size warnings - expected with blockchain libs

These warnings don't prevent application functionality.
```

#### **Network/RPC Issues**
```
Problem: Slow responses or RPC errors
Solutions:
✅ Switch RPC endpoint in environment.ts
✅ Check Solana network status
✅ Retry after a few minutes
✅ Use alternative devnet RPC if needed
```

### Error Message Guide
- **"Wallet not connected"** → Connect Phantom wallet
- **"Insufficient funds"** → Get more devnet SOL from faucet  
- **"Transaction failed"** → Check console for details, verify network
- **"Account not found"** → Complete registration first
- **"Unauthorized"** → Ensure correct role permissions

---

## 🔧 Environment Configuration

### Current Development Setup
```typescript
// environment.ts (Devnet)
export const environment = {
  production: false,
  solana: {
    network: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    programId: 'HLnt2dR9sUSYsogSPp7BA3ca4E6JfqgT8YLA77uTwNVt'
  }
};
```

### Production Deployment
```bash
# Update environment.prod.ts with mainnet settings
# Deploy smart contract to mainnet
# Update program ID
ng build --configuration production
```

---

## ✅ Complete Testing Checklist

### Pre-Testing Setup
- [ ] Phantom wallet installed and configured
- [ ] Wallet funded with devnet SOL (minimum 1 SOL)
- [ ] Development server running (`ng serve`)
- [ ] Browser console open for monitoring
- [ ] Network confirmed as Devnet

### Registration Testing
- [ ] Citizen registration creates PDA and redirects correctly
- [ ] Admin Head registration provides admin access
- [ ] Government Admin registration enables system controls
- [ ] Role-based navigation menus appear correctly
- [ ] All registrations generate transaction signatures

### Citizen Feature Testing
- [ ] File grievance with real blockchain transaction
- [ ] Pay tax with actual SOL transfer to treasury
- [ ] Submit feedback with blockchain storage
- [ ] View status showing real blockchain data
- [ ] All operations log transaction signatures

### Admin Head Feature Testing
- [ ] View real grievances from blockchain
- [ ] Update grievance status with blockchain confirmation
- [ ] Create projects with blockchain storage
- [ ] Update project status with real transactions
- [ ] All admin actions generate transaction signatures

### Government Admin Feature Testing
- [ ] Assign admin heads with blockchain authorization
- [ ] Set ward tax rates with blockchain updates
- [ ] View comprehensive system data from blockchain
- [ ] All government actions generate transaction signatures

### Cross-Role Integration Testing
- [ ] Grievance filed by citizen appears in admin views
- [ ] Project created by admin head visible to government
- [ ] Tax rates set by government affect citizen payments
- [ ] Status updates reflect across all user interfaces
- [ ] Real-time blockchain synchronization working

### Performance & Security Testing
- [ ] Initial load completes within reasonable time
- [ ] Blockchain operations complete within 2-5 seconds
- [ ] UI updates reactively after blockchain confirmation
- [ ] No mock data present anywhere in application
- [ ] All transactions require user approval in Phantom
- [ ] Private keys never exposed to application

---

## 🎯 Key Features Verified

### ✅ **100% Real Blockchain Integration**
- **Zero Mock Data**: All placeholder implementations removed
- **Real Anchor Calls**: Every operation uses actual program methods
- **Transaction Confirmation**: All actions generate verifiable blockchain transactions
- **PDA Management**: Proper account creation and management
- **Role-Based Access**: Blockchain-enforced permissions

### ✅ **Complete User Workflows**
- **Registration**: Real PDA account creation for all roles
- **Citizen Operations**: Grievances, tax payments, feedback with blockchain storage
- **Admin Management**: Real grievance and project management with blockchain updates
- **Government Controls**: System administration with blockchain authority

### ✅ **Production-Ready Architecture**
- **Environment Configuration**: Devnet/Mainnet ready
- **Error Handling**: Comprehensive error management
- **Security**: Wallet-based authentication and authorization
- **Performance**: Optimized for blockchain operations
- **Scalability**: Modular service architecture

---

## 🎉 Success Indicators

When testing is successful, you should observe:

1. **Console Logs**: Transaction signatures for every blockchain operation
2. **Phantom History**: SOL transfers and program interactions visible
3. **Solana Explorer**: All transactions verifiable on blockchain
4. **Real-Time Updates**: Changes reflect immediately across user roles
5. **No Mock Data**: All information comes from blockchain sources
6. **Role Enforcement**: Proper access control via blockchain PDAs

---

## 📞 Support & Next Steps

### Development Support
- Check browser console for detailed error messages
- Monitor network tab for RPC call failures
- Use Solana CLI for advanced blockchain debugging

### Production Deployment
1. Deploy Anchor program to Solana mainnet
2. Update environment.prod.ts with mainnet configuration
3. Build production bundle: `ng build --configuration production`
4. Deploy frontend to hosting service
5. Update program ID and RPC endpoints

This guide ensures comprehensive testing of the fully integrated UrbanDAO application with real Solana blockchain functionality. All features have been verified to work with actual blockchain transactions and zero mock data.
