import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    memberIds: v.array(v.id("users")), // IDs of OTHER members to add
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    if (!user) throw new Error("Unauthenticated");

    // Validate limit: Creator + args.memberIds.length <= 3
    if (args.memberIds.length > 2) {
      throw new Error("Group limit reached: Max 3 members allowed (you + 2 others).");
    }

    // Check if these users exist
    for (const memberId of args.memberIds) {
      const member = await ctx.db.get(memberId);
      if (!member) throw new Error(`User with ID ${memberId} not found`);
    }

    const members = [
      { userId: user._id, role: "admin", joinedAt: Date.now() },
      ...args.memberIds.map((id) => ({
        userId: id,
        role: "member",
        joinedAt: Date.now(),
      })),
    ];

    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      description: args.description,
      createdBy: user._id,
      members: members,
    });

    return groupId;
  },
});

export const updateGroup = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    memberIds: v.optional(v.array(v.id("users"))), // Full list of OTHER members
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const isAdmin = group.members.some(
      (m) => m.userId === user._id && m.role === "admin"
    );
    if (!isAdmin) throw new Error("Only admins can edit group");

    const patch = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;

    if (args.memberIds !== undefined) {
      if (args.memberIds.length > 2) {
         throw new Error("Group limit reached: Max 3 members allowed (you + 2 others).");
      }
      // Reconstruct members array preserving the current user (admin)
      // and overwriting others.
      // NOTE: This simple approach assumes the caller sends the full list of *other* participants.
      patch.members = [
        { userId: user._id, role: "admin", joinedAt: group.members.find(m => m.userId === user._id)?.joinedAt || Date.now() },
        ...args.memberIds.map(id => ({ userId: id, role: "member", joinedAt: Date.now() }))
      ];
    }

    await ctx.db.patch(args.groupId, patch);
    return true;
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const isAdmin = group.members.some(
        (m) => m.userId === user._id && m.role === "admin"
    );
    if (!isAdmin) throw new Error("Only admins can delete group");

    // Clean up expenses and settlements?
    // Depending on requirements, we might just delete the group structure.
    // Ideally, we should check if there are unsettled debts.
    // For now, let's just delete the group record.
    // The expenses refer to groupId, so they will be orphaned or we should verify logic.
    // Requirements say "Delete group with expense handling".
    // Let's safe delete: only if no debts? Or cascade?
    // "Remove participants (with linked expense handling)" is simpler.
    // Let's just delete the group document for now.

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Strategy: Clear groupId from expenses (make them non-group expenses) OR delete them?
    // Usually, deleting a group shouldn't delete the history of expenses if they are important.
    // But Splitwise usually deletes them or warns.
    // Let's choose to delete expenses for now to be clean.
    for (const exp of expenses) {
       await ctx.db.delete(exp._id);
    }
     const settlements = await ctx.db
      .query("settlements")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();
    for (const s of settlements) {
        await ctx.db.delete(s._id);
    }

    await ctx.db.delete(args.groupId);
    return true;
  },
});

export const getGroupOrMembers = query({
  args: {
    groupId: v.optional(v.id("groups")), // Optional - if provided, will return details for just this group
  },
  handler: async (ctx, args) => {
    // Use centralized getCurrentUser function
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    // Get all groups where the user is a member
    const allGroups = await ctx.db.query("groups").collect();
    const userGroups = allGroups.filter((group) =>
      group.members.some((member) => member.userId === currentUser._id)
    );

    // If a specific group ID is provided, only return details for that group
    if (args.groupId) {
      const selectedGroup = userGroups.find(
        (group) => group._id === args.groupId
      );

      if (!selectedGroup) {
        throw new Error("Group not found or you're not a member");
      }

      // Get all user details for this group's members
      const memberDetails = await Promise.all(
        selectedGroup.members.map(async (member) => {
          const user = await ctx.db.get(member.userId);
          if (!user) return null;

          return {
            id: user._id,
            name: user.name,
            email: user.email,
            imageUrl: user.imageUrl,
            role: member.role,
          };
        })
      );

      // Filter out any null values (in case a user was deleted)
      const validMembers = memberDetails.filter((member) => member !== null);

      // Return selected group with member details
      return {
        selectedGroup: {
          id: selectedGroup._id,
          name: selectedGroup.name,
          description: selectedGroup.description,
          createdBy: selectedGroup.createdBy,
          members: validMembers,
        },
        groups: userGroups.map((group) => ({
          id: group._id,
          name: group.name,
          description: group.description,
          memberCount: group.members.length,
        })),
      };
    } else {
      // Just return the list of groups without member details
      return {
        selectedGroup: null,
        groups: userGroups.map((group) => ({
          id: group._id,
          name: group.name,
          description: group.description,
          memberCount: group.members.length,
        })),
      };
    }
  },
});

// Get expenses for a specific group
export const getGroupExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    // Use centralized getCurrentUser function
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("Group not found");

    if (!group.members.some((m) => m.userId === currentUser._id))
      throw new Error("You are not a member of this group");

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const settlements = await ctx.db
      .query("settlements")
      .filter((q) => q.eq(q.field("groupId"), groupId))
      .collect();

    /* ----------  member map ---------- */
    const memberDetails = await Promise.all(
      group.members.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return { id: u._id, name: u.name, imageUrl: u.imageUrl, role: m.role };
      })
    );
    const ids = memberDetails.map((m) => m.id);

    /* ----------  ledgers ---------- */
    // total net balance (old behaviour)
    const totals = Object.fromEntries(ids.map((id) => [id, 0]));
    // pair‑wise ledger  debtor -> creditor -> amount
    const ledger = {};
    ids.forEach((a) => {
      ledger[a] = {};
      ids.forEach((b) => {
        if (a !== b) ledger[a][b] = 0;
      });
    });

    /* ----------  apply expenses ---------- */
    for (const exp of expenses) {
      const payer = exp.paidByUserId;
      for (const split of exp.splits) {
        if (split.userId === payer || split.paid) continue; // skip payer & settled
        const debtor = split.userId;
        const amt = split.amount;

        totals[payer] += amt;
        totals[debtor] -= amt;

        ledger[debtor][payer] += amt; // debtor owes payer
      }
    }

    /* ----------  apply settlements ---------- */
    for (const s of settlements) {
      totals[s.paidByUserId] += s.amount;
      totals[s.receivedByUserId] -= s.amount;

      ledger[s.paidByUserId][s.receivedByUserId] -= s.amount; // they paid back
    }

    /* ----------  net the pair‑wise ledger ---------- */
    ids.forEach((a) => {
      ids.forEach((b) => {
        if (a >= b) return; // visit each unordered pair once
        const diff = ledger[a][b] - ledger[b][a];
        if (diff > 0) {
          ledger[a][b] = diff;
          ledger[b][a] = 0;
        } else if (diff < 0) {
          ledger[b][a] = -diff;
          ledger[a][b] = 0;
        } else {
          ledger[a][b] = ledger[b][a] = 0;
        }
      });
    });

    /* ----------  simplify debts (minimize transactions) ---------- */
    // Algorithm:
    // 1. Calculate net balance for each user
    // 2. Separate into debtors and creditors
    // 3. Greedy match
    const netBalances = {};
    ids.forEach(id => netBalances[id] = 0);
    
    // Compute net balances from the pairwise ledger
    ids.forEach(a => {
        ids.forEach(b => {
            if (ledger[a][b] > 0) {
                netBalances[a] -= ledger[a][b];
                netBalances[b] += ledger[a][b];
            }
        });
    });

    const debtors = ids.filter(id => netBalances[id] < -0.01).map(id => ({ id, amount: -netBalances[id] }));
    const creditors = ids.filter(id => netBalances[id] > 0.01).map(id => ({ id, amount: netBalances[id] }));

    // Sort to be deterministic (largest amounts first)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const suggestedSettlements = [];
    
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        const amount = Math.min(debtor.amount, creditor.amount);
        
        // Improve rounding
        const safeAmount = Math.round(amount * 100) / 100;

        if (safeAmount > 0) {
            suggestedSettlements.push({
                from: debtor.id,
                to: creditor.id,
                amount: safeAmount
            });
        }

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    /* ----------  shape the response ---------- */
    const balances = memberDetails.map((m) => ({
      ...m,
      totalBalance: totals[m.id],
      owes: Object.entries(ledger[m.id])
        .filter(([, v]) => v > 0)
        .map(([to, amount]) => ({ to, amount })),
      owedBy: ids
        .filter((other) => ledger[other][m.id] > 0)
        .map((other) => ({ from: other, amount: ledger[other][m.id] })),
    }));

    const userLookupMap = {};
    memberDetails.forEach((member) => {
      userLookupMap[member.id] = member;
    });

    return {
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
      },
      members: memberDetails,
      expenses,
      settlements,
      balances,
      suggestedSettlements,
      userLookupMap,
    };
  },
});
