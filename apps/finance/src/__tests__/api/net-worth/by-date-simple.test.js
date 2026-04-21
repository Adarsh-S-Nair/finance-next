/**
 * @jest-environment node
 */

// Simple test to verify the net worth calculation logic
describe('Net Worth by Date Logic', () => {
  // Mock the isLiabilityAccount function
  const isLiabilityAccount = (account) => {
    const liabilityTypes = ['credit card', 'credit', 'loan', 'mortgage', 'line of credit', 'overdraft', 'other'];
    const accountType = (account.subtype || account.type || '').toLowerCase();
    return liabilityTypes.some(type => accountType.includes(type));
  };

  it('should include all user accounts for each date using most recent snapshots', () => {
    // Test data simulating your scenario
    const accounts = [
      { id: 'acc1', name: 'Checking', type: 'depository', subtype: 'checking' },
      { id: 'acc2', name: 'Savings', type: 'depository', subtype: 'savings' },
      { id: 'acc3', name: 'Credit Card 1', type: 'credit', subtype: 'credit card' },
      { id: 'acc4', name: 'Investment', type: 'investment', subtype: 'brokerage' },
      { id: 'acc5', name: 'Credit Card 2', type: 'credit', subtype: 'credit card' }
    ];

    // Simulate snapshots: some accounts have snapshots on 09-21, others on 09-22
    const snapshots = {
      'acc1': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 1000 },
        { recorded_at: '2025-09-22T10:00:00Z', current_balance: 1200 }
      ],
      'acc2': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 5000 }
      ],
      'acc3': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 500 }
      ],
      'acc4': [
        { recorded_at: '2025-09-22T10:00:00Z', current_balance: 15000 }
      ],
      'acc5': [
        { recorded_at: '2025-09-22T10:00:00Z', current_balance: 200 }
      ]
    };

    const dates = ['2025-09-21', '2025-09-22'];
    const results = [];

    // Simulate the logic for each date
    for (const dateString of dates) {
      const targetDate = new Date(dateString + 'T23:59:59Z');
      let totalAssets = 0;
      let totalLiabilities = 0;
      const accountBalances = {};

      console.log(`\n📅 Calculating net worth for date: ${dateString}`);

      // For each account, get the most recent snapshot on or before this date
      for (const account of accounts) {
        const accountSnapshots = snapshots[account.id] || [];
        
        // Find the most recent snapshot on or before the target date
        const latestSnapshot = accountSnapshots
          .filter(snapshot => new Date(snapshot.recorded_at) <= targetDate)
          .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];

        const balance = latestSnapshot ? latestSnapshot.current_balance : 0;
        const isLiability = isLiabilityAccount(account);
        
        console.log(`  💰 ${account.name}: $${balance} ${isLiability ? '(liability)' : '(asset)'}`);

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
      
      console.log(`  📊 Assets: $${totalAssets}, Liabilities: $${totalLiabilities}, Net Worth: $${netWorth}`);
      console.log(`  📈 Accounts included: ${Object.keys(accountBalances).length}/${accounts.length}`);

      results.push({
        date: dateString,
        assets: totalAssets,
        liabilities: totalLiabilities,
        netWorth: netWorth,
        accountBalances: accountBalances,
        totalAccounts: accounts.length,
        accountsWithData: Object.keys(accountBalances).length
      });
    }

    // Verify results
    expect(results).toHaveLength(2);
    
    // For 2025-09-21: Should include acc1 (1000), acc2 (5000), acc3 (500)
    // Assets: 1000 + 5000 = 6000, Liabilities: 500, Net Worth: 5500
    expect(results[0].date).toBe('2025-09-21');
    expect(results[0].assets).toBe(6000);
    expect(results[0].liabilities).toBe(500);
    expect(results[0].netWorth).toBe(5500);
    expect(results[0].accountsWithData).toBe(5); // All 5 accounts should be included
    
    // For 2025-09-22: Should include acc1 (1200), acc2 (5000 from 09-21), acc3 (500 from 09-21), acc4 (15000), acc5 (200)
    // Assets: 1200 + 5000 + 15000 = 21200, Liabilities: 500 + 200 = 700, Net Worth: 20500
    expect(results[1].date).toBe('2025-09-22');
    expect(results[1].assets).toBe(21200);
    expect(results[1].liabilities).toBe(700);
    expect(results[1].netWorth).toBe(20500);
    expect(results[1].accountsWithData).toBe(5); // All 5 accounts should be included

    // Verify account balances for 2025-09-22 include all accounts
    expect(results[1].accountBalances.acc1).toBe(1200); // Most recent on 09-22
    expect(results[1].accountBalances.acc2).toBe(5000); // Most recent on 09-21
    expect(results[1].accountBalances.acc3).toBe(-500); // Most recent on 09-21
    expect(results[1].accountBalances.acc4).toBe(15000); // Most recent on 09-22
    expect(results[1].accountBalances.acc5).toBe(-200); // Most recent on 09-22
  });

  it('should handle accounts with no snapshots', () => {
    const accounts = [
      { id: 'acc1', name: 'Checking', type: 'depository', subtype: 'checking' },
      { id: 'acc2', name: 'Savings', type: 'depository', subtype: 'savings' }
    ];

    const snapshots = {
      'acc1': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 1000 }
      ]
      // acc2 has no snapshots
    };

    const dateString = '2025-09-21';
    const targetDate = new Date(dateString + 'T23:59:59Z');
    let totalAssets = 0;
    let totalLiabilities = 0;
    const accountBalances = {};

    for (const account of accounts) {
      const accountSnapshots = snapshots[account.id] || [];
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

    expect(totalAssets).toBe(1000); // Only acc1 has balance
    expect(totalLiabilities).toBe(0);
    expect(Object.keys(accountBalances)).toHaveLength(2); // Both accounts included
    expect(accountBalances.acc1).toBe(1000);
    expect(accountBalances.acc2).toBe(0); // No snapshot, defaults to 0
  });

  it('should use current balances for the most recent date', () => {
    const accounts = [
      { id: 'acc1', name: 'Checking', type: 'depository', subtype: 'checking', balances: { current: 1500 } },
      { id: 'acc2', name: 'Credit Card', type: 'credit', subtype: 'credit card', balances: { current: 300 } }
    ];

    const snapshots = {
      'acc1': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 1000 }
      ],
      'acc2': [
        { recorded_at: '2025-09-21T10:00:00Z', current_balance: 200 }
      ]
    };

    const dates = ['2025-09-21', '2025-09-22']; // 09-22 is most recent
    const results = [];

    for (const dateString of dates) {
      const targetDate = new Date(dateString + 'T23:59:59Z');
      const sortedDates = [...dates].sort((a, b) => new Date(b) - new Date(a));
      const mostRecentDate = sortedDates[0];
      const isMostRecentDate = dateString === mostRecentDate;
      
      let totalAssets = 0;
      let totalLiabilities = 0;
      const accountBalances = {};

      for (const account of accounts) {
        let balance = 0;
        
        if (isMostRecentDate) {
          // Use current balance from accounts table for the most recent date
          balance = account.balances?.current || 0;
        } else {
          // For historical dates, get the most recent snapshot on or before this date
          const accountSnapshots = snapshots[account.id] || [];
          const latestSnapshot = accountSnapshots
            .filter(snapshot => new Date(snapshot.recorded_at) <= targetDate)
            .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
          balance = latestSnapshot ? latestSnapshot.current_balance : 0;
        }

        const isLiability = isLiabilityAccount(account);
        
        if (isLiability) {
          totalLiabilities += Math.abs(balance);
          accountBalances[account.id] = -Math.abs(balance);
        } else {
          totalAssets += balance;
          accountBalances[account.id] = balance;
        }
      }

      results.push({
        date: dateString,
        assets: totalAssets,
        liabilities: totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        usesCurrentBalances: isMostRecentDate
      });
    }

    // For 2025-09-21: Should use snapshot data (1000, 200)
    expect(results[0].date).toBe('2025-09-21');
    expect(results[0].assets).toBe(1000);
    expect(results[0].liabilities).toBe(200);
    expect(results[0].netWorth).toBe(800);
    expect(results[0].usesCurrentBalances).toBe(false);

    // For 2025-09-22: Should use current balances (1500, 300)
    expect(results[1].date).toBe('2025-09-22');
    expect(results[1].assets).toBe(1500);
    expect(results[1].liabilities).toBe(300);
    expect(results[1].netWorth).toBe(1200);
    expect(results[1].usesCurrentBalances).toBe(true);
  });
});
