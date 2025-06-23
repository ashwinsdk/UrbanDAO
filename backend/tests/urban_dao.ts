import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UrbanDao } from "../target/types/urban_dao";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
// import { 
//   GrievanceStatus, 
//   ProjectStatus 
// } from "../target/types/urban_dao";
import { expect } from "chai";

describe("urban_dao", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.UrbanDao as Program<UrbanDao>;

  // Generate keypairs for testing
  const govt = Keypair.generate();
  const adminHead = Keypair.generate();
  const user = Keypair.generate();
  const anotherUser = Keypair.generate();

  // PDAs
  const [statePda, stateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );

  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    program.programId
  );

  // Test constants
  const ward = 1;
  const taxAmount = anchor.web3.LAMPORTS_PER_SOL * 0.1; // 0.1 SOL
  const year = 2024;
  let wardTaxPda: PublicKey;
  let taxPaymentPda: PublicKey;
  let grievancePda: PublicKey;
  let projectPda: PublicKey;
  let feedbackPda: PublicKey;

  before(async () => {
    // Fund accounts
    await Promise.all([
      airdrop(govt.publicKey, 10),
      airdrop(adminHead.publicKey, 10),
      airdrop(user.publicKey, 10),
      airdrop(anotherUser.publicKey, 10),
    ]);
  });

  async function airdrop(pubkey: PublicKey, sol: number) {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      sol * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  }

  it("Initializes program state", async () => {
    await program.methods.initialize(govt.publicKey)
      .accounts({
        state: statePda,
        treasury: treasuryPda,
        user: govt.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([govt])
      .rpc();

    const state = await program.account.state.fetch(statePda);
    expect(state.adminGovt).to.eql(govt.publicKey);
    expect(state.adminHead).to.eql(PublicKey.default);
    expect(state.currentTaxYear).to.equal(2024);
    expect(state.treasuryBump).to.be.a('number');
    expect(state.stateBump).to.equal(stateBump);
  });

  it("Assigns admin head", async () => {
    await program.methods.assignAdminHead(adminHead.publicKey)
      .accounts({
        state: statePda,
        adminGovt: govt.publicKey,
      })
      .signers([govt])
      .rpc();

    const state = await program.account.state.fetch(statePda);
    expect(state.adminHead).to.eql(adminHead.publicKey);
  });

  it("Sets ward tax", async () => {
    const [wardTaxKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("ward_tax"), new anchor.BN(ward).toArrayLike(Buffer, "le", 2)],
      program.programId
    );
    wardTaxPda = wardTaxKey;

    await program.methods.setWardTax(ward, new anchor.BN(taxAmount))
      .accounts({
        state: statePda,
        wardTax: wardTaxPda,
        adminGovt: govt.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([govt])
      .rpc();

    const wardTax = await program.account.wardTax.fetch(wardTaxPda);
    expect(wardTax.ward).to.equal(ward);
    expect(wardTax.amount.toString()).to.equal(taxAmount.toString());
  });

  it("Pays tax", async () => {
    const [taxPaymentKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tax"), user.publicKey.toBuffer(), new anchor.BN(year).toArrayLike(Buffer, "le", 2)],
      program.programId
    );
    taxPaymentPda = taxPaymentKey;

    const userBalanceBefore = await provider.connection.getBalance(user.publicKey);
    const treasuryBalanceBefore = await provider.connection.getBalance(treasuryPda);

    await program.methods.payTax(ward, year)
      .accounts({
        taxPayment: taxPaymentPda,
        wardTax: wardTaxPda,
        user: user.publicKey,
        treasury: treasuryPda,
        state: statePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const taxPayment = await program.account.taxPayment.fetch(taxPaymentPda);
    expect(taxPayment.user).to.eql(user.publicKey);
    expect(taxPayment.amount.toString()).to.equal(taxAmount.toString());
    expect(taxPayment.year).to.equal(year);

    // Verify funds transferred
    const userBalanceAfter = await provider.connection.getBalance(user.publicKey);
    const treasuryBalanceAfter = await provider.connection.getBalance(treasuryPda);

    expect(userBalanceBefore - userBalanceAfter).to.be.greaterThan(taxAmount);
    expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(taxAmount);
  });

  it("Files a grievance", async () => {
    const grievanceKey = Keypair.generate();
    grievancePda = grievanceKey.publicKey;

    const details = "Street lights not working in ward 1";

    await program.methods.fileGrievance(details)
      .accounts({
        grievance: grievancePda,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user, grievanceKey])
      .rpc();

    const grievance = await program.account.grievance.fetch(grievancePda);
    expect(grievance.user).to.eql(user.publicKey);
    expect(grievance.details).to.equal(details);
    expect(grievance.status).to.deep.equal({ pending: {} });
  });

  it("Updates grievance status", async () => {
    await program.methods.updateGrievanceStatus({ accepted: {} })
      .accounts({
        grievance: grievancePda,
        adminHead: adminHead.publicKey,
        state: statePda,
      })
      .signers([adminHead])
      .rpc();

    const grievance = await program.account.grievance.fetch(grievancePda);
    expect(grievance.status).to.deep.equal({ accepted: {} });
  });

  it("Creates a project", async () => {
    const projectKey = Keypair.generate();
    projectPda = projectKey.publicKey;

    const name = "Ward 1 Street Light Repair";
    const details = "Install new LED street lights across ward 1";

    await program.methods.createProject(name, details)
      .accounts({
        project: projectPda,
        adminHead: adminHead.publicKey,
        state: statePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([adminHead, projectKey])
      .rpc();

    const project = await program.account.project.fetch(projectPda);
    expect(project.name).to.equal(name);
    expect(project.details).to.equal(details);
    expect(project.status).to.deep.equal({ planning: {} });
  });

  it("Updates project status", async () => {
    // First update to Ongoing
    await program.methods.updateProjectStatus({ ongoing: {} })
      .accounts({
        project: projectPda,
        adminHead: adminHead.publicKey,
        state: statePda,
      })
      .signers([adminHead])
      .rpc();

    let project = await program.account.project.fetch(projectPda);
    expect(project.status).to.deep.equal({ ongoing: {} });

    // Then update to Done
    await program.methods.updateProjectStatus({ done: {} })
      .accounts({
        project: projectPda,
        adminHead: adminHead.publicKey,
        state: statePda,
      })
      .signers([adminHead])
      .rpc();

    project = await program.account.project.fetch(projectPda);
    expect(project.status).to.deep.equal({ done: {} });
  });

  it("Gives feedback on a project", async () => {
    const feedbackKey = Keypair.generate();
    feedbackPda = feedbackKey.publicKey;

    const comment = "Lights are working great now!";
    const satisfied = true;

    await program.methods.giveFeedback(comment, satisfied)
      .accounts({
        feedback: feedbackPda,
        project: projectPda,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user, feedbackKey])
      .rpc();

    const feedback = await program.account.feedback.fetch(feedbackPda);
    expect(feedback.user).to.eql(user.publicKey);
    expect(feedback.project).to.eql(projectPda);
    expect(feedback.comment).to.equal(comment);
    expect(feedback.satisfied).to.equal(satisfied);
  });

  it("Prevents unauthorized actions", async () => {
    // Non-govt trying to assign admin head
    try {
      await program.methods.assignAdminHead(anotherUser.publicKey)
        .accounts({
          state: statePda,
          adminGovt: anotherUser.publicKey,
        })
        .signers([anotherUser])
        .rpc();
      expect.fail("Should have failed");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("Unauthorized");
    }

    // Non-adminHead trying to create project
    try {
      const projectKey = Keypair.generate();
      await program.methods.createProject("Invalid", "Project")
        .accounts({
          project: projectKey.publicKey,
          adminHead: anotherUser.publicKey,
          state: statePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([anotherUser, projectKey])
        .rpc();
      expect.fail("Should have failed");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("Unauthorized");
    }

    // Giving feedback on non-completed project
    try {
      // Create a project that's not done
      const projectKey = Keypair.generate();
      await program.methods.createProject("Incomplete", "Project")
        .accounts({
          project: projectKey.publicKey,
          adminHead: adminHead.publicKey,
          state: statePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([adminHead, projectKey])
        .rpc();

      const feedbackKey = Keypair.generate();
      await program.methods.giveFeedback("Test", true)
        .accounts({
          feedback: feedbackKey.publicKey,
          project: projectKey.publicKey,
          user: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user, feedbackKey])
        .rpc();
      expect.fail("Should have failed");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("ProjectNotDone");
    }
  });
});