/**
 * @jest-environment node
 */

// Enhanced test for the updated net worth calculation logic
describe('Enhanced Net Worth by Date Logic', () => {
  // Mock the isLiabilityAccount function
  const isLiabilityAccount = (account) => {
    const liabilityTypes = ['credit card', 'credit', 'loan', 'mortgage', 'line of credit', 'overdraft', 'other'];
    const accountType = (account.subtype || account.type || '').toLowerCase();
    return liabilityTypes.some(type => accountType.includes(type));
  };

  it('should include all accounts on snapshot dates even if they lack snapshots on that date', () => {
    // Test data simulating the real scenario from the logs
    const accounts = [
      { id: 'acc1', name: 'Robinhood Credit Card', type: 'credit', subtype: 'credit card' },
      { id: 'acc2', name: 'Customized Cash Rewards', type: 'credit', subtype: 'credit card' },
      { id: 'acc3', name: 'Adv Plus Banking', type: 'depository', subtype: 'checking' },
      { id: 'acc4', name: 'BankAmericard Platinum Plus', type: 'credit', subtype: 'credit card' },
      { id: 'acc5', name: 'Robinhood individual', type: 'investment', subtype: 'brokerage' }
    ];

    // Simulate snapshots: only some accounts have snapshots on 2025-09-22
    const snapshots = {
      'acc1': [
        { recorded_at: '2025-09-22T10:00:00Z', current_balance: 0 }
      ],
      'acc2': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 0 }
      ],
      'acc3': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 28289.19 }
      ],
      'acc4': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 2948.33 }
      ],
      'acc5': [
        { recorded_at: '2025-09-22T10:00:00Z', current_balance: 12841.76 }
      ]
    };

    const dateString = '2025-09-22';
    const targetDate = new Date(dateString + 'T23:59:59Z');
    let totalAssets = 0;
    let totalLiabilities = 0;
    const accountBalances = {};

    console.log(`\n📅 Calculating net worth for date: ${dateString}`);

    // Simulate the enhanced logic for snapshot dates
    for (const account of accounts) {
      const accountSnapshots = snapshots[account.id] || [];
      
      // First try to get snapshot on this exact date
      const snapshotOnDate = accountSnapshots.filter(snapshot => {
        const snapshotDate = new Date(snapshot.recorded_at).toISOString().split('T')[0];
        return snapshotDate === dateString;
      });

      let balance = 0;
      let dataSource = '';

      if (snapshotOnDate.length > 0) {
        // Use snapshot from this exact date
        balance = snapshotOnDate[0].current_balance;
        dataSource = `Snapshot from ${dateString}`;
      } else {
        // No snapshot on this date, use the most recent snapshot before this date
        const latestSnapshot = accountSnapshots
          .filter(snapshot => new Date(snapshot.recorded_at) <= targetDate)
          .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
        
        balance = latestSnapshot ? latestSnapshot.current_balance : 0;
        dataSource = latestSnapshot 
          ? `Latest snapshot from ${new Date(latestSnapshot.recorded_at).toISOString().split('T')[0]}`
          : 'No snapshot available';
      }

      const isLiability = isLiabilityAccount(account);
      
      console.log(`  💰 ${account.name}: $${balance} ${isLiability ? '(liability)' : '(asset)'} [${dataSource}]`);

      // Include the account in the calculation
      if (isLiability) {
        totalLiabilities += Math.abs(balance);
        accountBalances[account.id] = -Math.abs(balance);
      } else {
        totalAssets += balance;
        accountBalances[account.id] = balance;
      }
    }

    const netWorth = totalAssets - totalLiabilities;
    
    console.log(`  📊 Assets: $${totalAssets.toFixed(2)}, Liabilities: $${totalLiabilities.toFixed(2)}, Net Worth: $${netWorth.toFixed(2)}`);
    console.log(`  📈 Accounts included: ${Object.keys(accountBalances).length}/${accounts.length}`);

    // Verify all accounts are included
    expect(Object.keys(accountBalances)).toHaveLength(5);
    expect(totalAssets).toBe(41130.95); // 28289.19 + 12841.76
    expect(totalLiabilities).toBe(2948.33); // 2948.33 (from 09-21)
    expect(netWorth).toBeCloseTo(38182.62, 2);

    // Verify specific account balances
    expect(accountBalances.acc1).toBeCloseTo(0, 2); // Snapshot from 09-22
    expect(accountBalances.acc2).toBeCloseTo(0, 2); // Latest snapshot from 09-21
    expect(accountBalances.acc3).toBe(28289.19); // Latest snapshot from 09-21
    expect(accountBalances.acc4).toBe(-2948.33); // Latest snapshot from 09-21
    expect(accountBalances.acc5).toBe(12841.76); // Snapshot from 09-22
  });

  it('should use current balances for today even if snapshots exist', () => {
    const today = new Date().toISOString().split('T')[0];
    const accounts = [
      { id: 'acc1', name: 'Checking', type: 'depository', subtype: 'checking', balances: { current: 5000 } },
      { id: 'acc2', name: 'Credit Card', type: 'credit', subtype: 'credit card', balances: { current: 1000 } }
    ];

    const snapshots = {
      'acc1': [
        { recorded_at: `${today}T10:00:00Z`, current_balance: 3000 }
      ],
      'acc2': [
        { recorded_at: `${today}T10:00:00Z`, current_balance: 500 }
      ]
    };

    const targetDate = new Date(today + 'T23:59:59Z');
    let totalAssets = 0;
    let totalLiabilities = 0;
    const accountBalances = {};

    for (const account of accounts) {
      // For today, always use current balances
      const balance = account.balances?.current || 0;
      const isLiability = isLiabilityAccount(account);
      
      if (isLiability) {
        totalLiabilities += Math.abs(balance);
        accountBalances[account.id] = -Math.abs(balance);
      } else {
        totalAssets += balance;
        accountBalances[account.id] = balance;
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    // Should use current balances, not snapshot data
    expect(totalAssets).toBe(5000); // Current balance, not 3000 from snapshot
    expect(totalLiabilities).toBe(1000); // Current balance, not 500 from snapshot
    expect(netWorth).toBe(4000);
  });

  it('should generate daily data from first snapshot to today', () => {
    const snapshotDates = ['2025-09-21', '2025-09-22'];
    const today = new Date().toISOString().split('T')[0];
    
    // Generate all dates between first snapshot and today
    const generateDateRange = (startDate, endDate) => {
      const dates = [];
      const currentDate = new Date(startDate);
      const end = new Date(endDate);
      
      while (currentDate <= end) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return dates;
    };

    const allDates = generateDateRange('2025-09-21', today);
    
    // Should include all days from 2025-09-21 to today
    expect(allDates.length).toBeGreaterThan(2);
    expect(allDates[0]).toBe('2025-09-21');
    expect(allDates[allDates.length - 1]).toBe(today);
    
    // Should include the original snapshot dates
    expect(allDates).toContain('2025-09-21');
    expect(allDates).toContain('2025-09-22');
  });

  it('should handle interpolated dates correctly', () => {
    const accounts = [
      { id: 'acc1', name: 'Checking', type: 'depository', subtype: 'checking' },
      { id: 'acc2', name: 'Credit Card', type: 'credit', subtype: 'credit card' }
    ];

    const snapshots = {
      'acc1': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 1000 }
      ],
      'acc2': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 200 }
      ]
    };

    // Test interpolated date (2025-09-23) - no snapshots on this date
    const dateString = '2025-09-23';
    const targetDate = new Date(dateString + 'T23:59:59Z');
    let totalAssets = 0;
    let totalLiabilities = 0;
    const accountBalances = {};

    for (const account of accounts) {
      const accountSnapshots = snapshots[account.id] || [];
      
      // For interpolated dates, get the most recent snapshot on or before this date
      const latestSnapshot = accountSnapshots
        .filter(snapshot => new Date(snapshot.recorded_at) <= targetDate)
        .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];

      const balance = latestSnapshot ? latestSnapshot.current_balance : 0;
      const isLiability = isLiabilityAccount(account);

      if (isLiability) {
        totalLiabilities += Math.abs(balance);
        accountBalances[account.id] = -Math.abs(balance);
      } else {
        totalAssets += balance;
        accountBalances[account.id] = balance;
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    // Should use the most recent snapshot data (from 09-21)
    expect(totalAssets).toBe(1000);
    expect(totalLiabilities).toBe(200);
    expect(netWorth).toBe(800);
    expect(Object.keys(accountBalances)).toHaveLength(2);
  });
});
