# OutcomeReview

## Original Decision

- Run a staged release.

## Observed Outcome

- Error rate crossed the rollback threshold.

## Prediction Errors

- The expected error rate was too optimistic.

## Triggered Flip Conditions

- Triggered: Error rate exceeded 1 percent.
- Missed: None.
- Invalid or Unverifiable: None.

## Decision Quality

- pass | partial | fail: pass
- Reason: The decision defined and followed a reversible threshold.

## Execution Quality

- pass | partial | fail: pass
- Reason: The team rolled back when the condition triggered.

## Card Calibration

- Keep: 先写翻案条件
- Increase Weight: 最小后悔优先
- Decrease Weight: None
- Rewrite: None

## Next Decision

- Fix the observed failure before another staged release.
