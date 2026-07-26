import { derivConnection } from '../deriv/connection.ts';
import { discoverMarkets, pipToDecimals } from '../deriv/marketDiscovery.ts';
import { getMarkets } from '../deriv/symbols.ts';
import { getLastDigit, analyzeFrequencies, observedDecimals } from '../strategy/analyzer.ts';
import { getConfig } from '../strategy/config.ts';

async function diagnose() {
  console.log('='.repeat(60));
  console.log('DERIV API DIAGNOSTIC');
  console.log('='.repeat(60));

  await derivConnection.connect();

  // 1. Raw active_symbols — show every Volatility/Jump market with pip/decimals.
  console.log('\n--- Active Symbols (raw) ---');
  const symbolsRes = await derivConnection.send({
    active_symbols: 'full',
    product_type: 'basic',
  });

  if (symbolsRes?.active_symbols) {
    const wanted = symbolsRes.active_symbols.filter((s: any) => {
      const hay = `${s.market} ${s.submarket} ${s.display_name}`.toLowerCase();
      return hay.includes('volatility') || hay.includes('jump');
    });
    console.log(`Matched ${wanted.length} Volatility/Jump symbols:\n`);
    for (const s of wanted) {
      const suspended = s.is_trading_suspended ? ' [SUSPENDED]' : '';
      console.log(
        `  ${s.symbol.padEnd(10)} pip=${String(s.pip).padEnd(8)} ` +
        `decimals=${pipToDecimals(s.pip)}  ${s.display_name}${suspended}`,
      );
    }
  }

  // 2. Run our actual discovery + selection and print the resulting list.
  console.log('\n--- Discovered markets (post-filter) ---');
  await discoverMarkets();
  const markets = getMarkets();
  const vol = markets.filter((m) => m.market === 'Volatility');
  const jump = markets.filter((m) => m.market === 'Jump');
  console.log(`Total ${markets.length}: ${vol.length} Volatility, ${jump.length} Jump`);
  for (const m of markets) {
    console.log(`  ${m.symbol.padEnd(10)} decimals=${m.decimals}  ${m.displayName}`);
  }

  // 3. Digit distribution on the first market — verify precision is sane.
  const sample = markets[0];
  if (sample) {
    console.log(`\n--- Digit Distribution: ${sample.symbol} (${sample.displayName}) ---`);
    const { lookbackTicks } = getConfig();
    const tickRes = await derivConnection.send({
      ticks_history: sample.symbol,
      adjust_start_time: 1,
      count: lookbackTicks,
      end: 'latest',
      start: 1,
      style: 'ticks',
    });

    const prices: number[] | undefined = tickRes?.history?.prices;
    if (prices?.length) {
      const seen = Math.max(...prices.map(observedDecimals));
      const decimals = Math.max(sample.decimals, seen);
      console.log(`Got ${prices.length} prices; decimals: config=${sample.decimals} observed=${seen} → using ${decimals}`);
      console.log('Sample last-digit extraction:');
      for (const p of prices.slice(0, 5)) {
        console.log(`  ${p} → ${getLastDigit(p, decimals)}`);
      }

      const freqs = analyzeFrequencies(prices, decimals);
      const sum = freqs.reduce((a, f) => a + f.percentage, 0);
      console.log(`\nDigit frequencies (sum=${sum.toFixed(1)}%, expect ~100 and ~10% each):`);
      for (const f of freqs) {
        const bar = '█'.repeat(Math.round(f.percentage));
        console.log(`  ${f.digit}: ${f.percentage.toFixed(2)}% (${f.count}) ${bar}`);
      }
    } else {
      console.log('No prices returned:', JSON.stringify(tickRes).slice(0, 300));
    }
  }

  await derivConnection.disconnect();
  console.log('\n' + '='.repeat(60));
  console.log('Diagnostic complete');
  console.log('='.repeat(60));
}

diagnose().catch(console.error);
