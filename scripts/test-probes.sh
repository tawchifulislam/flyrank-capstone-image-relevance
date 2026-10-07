#!/usr/bin/env bash
set -u
fail=0
node scripts/probes/p1.js || fail=1
node scripts/probes/p2to6.js || fail=1
node scripts/eval.js > /tmp/eval-out.txt 2>&1
if [ $? -eq 0 ]; then
  p=$(node -e "const s=require('./eval/last-run.json').summary; console.log('top1 '+s.top1Precision+' ('+s.top1Correct+'/'+s.top1Total+') held-out '+s.heldOutPrecision+' no-match '+s.noMatchCorrect)")
  echo "PROBE 5 PASS | $p"
else
  echo "PROBE 5 FAIL"
  fail=1
fi
exit $fail
