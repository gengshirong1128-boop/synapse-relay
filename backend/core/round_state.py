from __future__ import annotations

from backend.schemas import RoundRecord, RoundStatus


def transition_round(round_record: RoundRecord, new_status: RoundStatus) -> RoundRecord:
    round_record.status = new_status
    return round_record
