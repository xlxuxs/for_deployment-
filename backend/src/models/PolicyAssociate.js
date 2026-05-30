const mongoose = require("mongoose");

const policyAssociateSchema = new mongoose.Schema(
  {
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Policy",
      required: true,
      index: true,
    },
    plannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    permissions: {
      type: [String],
      enum: ["moderate_comments", "reply_official", "export_data"],
      default: [],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Invitation tracking
    invitedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    reminderSentAt: { type: Date, default: null },
    acceptedAt: {
      type: Date,
      default: null,
    },

    // Status management
    invitationStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired", "revoked"],
      default: "pending",
      required: true,
      index: true,
    },

    // Revocation tracking
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revocationReason: {
      type: String,
      enum: ["owner_revoked", "admin_revoked", "self_revoked", "expired", null],
      default: null,
    },

    // Rejection tracking
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },

    // Audit trail
    lastModifiedAt: {
      type: Date,
      default: Date.now,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      notes: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound indexes for common queries
policyAssociateSchema.index({ plannerId: 1, invitationStatus: 1 });
policyAssociateSchema.index({ policyId: 1, invitationStatus: 1 });
policyAssociateSchema.index({ plannerId: 1, policyId: 1 }, { unique: false });
policyAssociateSchema.index({ expiresAt: 1, invitationStatus: 1 });

// ✅ IMPROVEMENT 2: Compound index for the most common query (planner's pending invitations sorted by expiry)
policyAssociateSchema.index({
  plannerId: 1,
  invitationStatus: 1,
  expiresAt: 1,
});

// Virtual: Check if invitation is expired
policyAssociateSchema.virtual("isExpired").get(function () {
  return (
    this.invitationStatus === "expired" ||
    (this.invitationStatus === "pending" &&
      this.expiresAt &&
      this.expiresAt < new Date())
  );
});

// Virtual: Check if invitation is pending
policyAssociateSchema.virtual("isPending").get(function () {
  return (
    this.invitationStatus === "pending" &&
    !this.acceptedAt &&
    !this.revokedAt &&
    !this.rejectedAt &&
    this.expiresAt > new Date()
  );
});

// Virtual: Days remaining until expiry
policyAssociateSchema.virtual("daysRemaining").get(function () {
  if (!this.expiresAt || this.expiresAt < new Date()) return 0;
  const diffTime = this.expiresAt - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual: Get invitation status for display
policyAssociateSchema.virtual("displayStatus").get(function () {
  if (this.revokedAt) return "revoked";
  if (this.rejectedAt) return "rejected";
  if (this.expiresAt && this.expiresAt < new Date()) return "expired";
  if (this.acceptedAt) return "accepted";
  return "pending";
});

// Instance method: Accept invitation
policyAssociateSchema.methods.accept = async function (acceptedBy) {
  if (!this.isPending) {
    throw new Error(
      `Cannot accept invitation with status: ${this.invitationStatus}`,
    );
  }

  this.acceptedAt = new Date();
  this.invitationStatus = "accepted";
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = acceptedBy;
  this.expiresAt = null;

  return this.save();
};

// Instance method: Reject invitation
policyAssociateSchema.methods.reject = async function (
  rejectedBy,
  reason = null,
) {
  if (this.invitationStatus !== "pending") {
    throw new Error(
      `Cannot reject invitation with status: ${this.invitationStatus}`,
    );
  }

  this.rejectedAt = new Date();
  this.invitationStatus = "rejected";
  this.rejectionReason = reason;
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = rejectedBy;
  this.expiresAt = null;

  return this.save();
};

// Instance method: Revoke (owner or admin)
policyAssociateSchema.methods.revoke = async function (
  revokedBy,
  reason = null,
) {
  if (this.invitationStatus === "revoked") {
    throw new Error("Already revoked");
  }

  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revocationReason =
    reason || (this.acceptedAt ? "owner_revoked" : "owner_revoked");
  this.invitationStatus = "revoked";
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = revokedBy;

  if (!this.acceptedAt) {
    this.expiresAt = null;
  }

  return this.save();
};

// Instance method: Mark as expired
policyAssociateSchema.methods.markExpired = async function () {
  if (this.invitationStatus !== "pending") {
    return this;
  }

  this.invitationStatus = "expired";
  this.revocationReason = "expired";
  this.lastModifiedAt = new Date();

  return this.save();
};

// Instance method: Update permissions
policyAssociateSchema.methods.updatePermissions = async function (
  newPermissions,
  updatedBy,
) {
  if (this.invitationStatus !== "accepted") {
    throw new Error(
      `Cannot update permissions for non-accepted associate. Status: ${this.invitationStatus}`,
    );
  }

  this.permissions = newPermissions;
  this.lastModifiedAt = new Date();
  this.lastModifiedBy = updatedBy;

  return this.save();
};

// Static method: Find pending invitations for a planner
policyAssociateSchema.statics.findPendingInvitations = function (plannerId) {
  return this.find({
    plannerId,
    invitationStatus: "pending",
    acceptedAt: null,
    revokedAt: null,
    rejectedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .populate(
      "policyId",
      "title description policyCode status startDate endDate pollType",
    )
    .populate("assignedBy", "email firstName lastName")
    .sort({ expiresAt: 1 });
};

// Static method: Find expired invitations (for cron job)
policyAssociateSchema.statics.findExpiredInvitations = function () {
  return this.find({
    invitationStatus: "pending",
    expiresAt: { $lt: new Date() },
  });
};

// Static method: Find active associates for a policy
policyAssociateSchema.statics.findActiveAssociates = function (policyId) {
  return this.find({
    policyId,
    invitationStatus: "accepted",
    acceptedAt: { $ne: null },
    revokedAt: null,
  })
    .populate("plannerId", "email firstName lastName region languagesSpoken")
    .populate("assignedBy", "email firstName lastName");
};

// Pre-save middleware: Ensure data consistency (async, no `next` parameter)
policyAssociateSchema.pre("save", async function () {
  if (this.invitationStatus === "accepted" && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
  if (this.invitationStatus === "rejected" && !this.rejectedAt) {
    this.rejectedAt = new Date();
  }
  if (this.invitationStatus === "revoked" && !this.revokedAt) {
    this.revokedAt = new Date();
  }
  if (this.invitationStatus === "pending" && !this.expiresAt) {
    this.expiresAt = new Date(this.invitedAt);
    this.expiresAt.setDate(this.expiresAt.getDate() + 30);
  }
  if (this.invitationStatus !== "pending") {
    this.expiresAt = null;
  }
  // No `next()` call – Mongoose awaits the promise returned by this async function.
});
module.exports = mongoose.model("PolicyAssociate", policyAssociateSchema);
