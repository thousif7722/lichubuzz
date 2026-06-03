'use strict';
const { User, Provider, Complaint } = require('../models');
const logger = require('./logger');

/**
 * Assigns a task to the least busy staff member with the given permission.
 * @param {String} permission - The permission required (e.g. 'manage_providers', 'manage_complaints')
 * @param {String} taskType - 'kyc' or 'complaint'
 * @param {String} teamId - Optional team ID to restrict assignment to a specific team
 * @returns {String|null} - The ID of the assigned staff member, or null if no eligible staff.
 */
async function getLeastBusyStaff(permission, taskType, teamId = null) {
  try {
    // 1. Find all staff with the required permission
    const query = {
      role: { $in: ['staff', 'team_leader', 'manager'] },
      isBlocked: false,
      permissions: permission,
    };
    if (teamId) query.teamId = teamId;

    const staffMembers = await User.find(query).select('_id').lean();

    if (staffMembers.length === 0) {
      logger.warn(`No active staff found with permission: ${permission} in team: ${teamId || 'any'}`);
      return null;
    }

    const staffIds = staffMembers.map(s => s._id);

    // 2. Count active tasks for each staff member based on taskType
    let workload = [];

    if (taskType === 'kyc') {
      workload = await Provider.aggregate([
        { $match: { 'kyc.status': 'submitted', assignedTo: { $in: staffIds } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
      ]);
    } else if (taskType === 'complaint') {
      workload = await Complaint.aggregate([
        { $match: { status: { $in: ['open', 'in_review'] }, assignedTo: { $in: staffIds } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
      ]);
    }

    // Convert workload array to a map for easy lookup
    const workloadMap = workload.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    // 3. Find the staff member with the minimum count
    let minStaffId = staffIds[0];
    let minCount = workloadMap[minStaffId.toString()] || 0;

    for (let i = 1; i < staffIds.length; i++) {
      const idStr = staffIds[i].toString();
      const count = workloadMap[idStr] || 0;
      if (count < minCount) {
        minCount = count;
        minStaffId = staffIds[i];
      }
    }

    return minStaffId;
  } catch (err) {
    logger.error(`Load balancer error (${taskType}):`, err);
    return null;
  }
}

module.exports = {
  getLeastBusyStaff,
};
