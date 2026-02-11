from __future__ import annotations

from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Investing Garden Signal Engine", version="0.1.0")


class SignalRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=10)
    closes: list[float] = Field(min_length=14, max_length=120)


class SignalResponse(BaseModel):
    ticker: str
    latest_close: float
    momentum_percent: float
    rsi14: float
    score: int
    label: Literal["bearish", "neutral", "bullish"]


def _compute_rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) <= period:
        raise ValueError("At least period + 1 closes are required")

    gains: list[float] = []
    losses: list[float] = []
    for index in range(1, period + 1):
        delta = closes[index] - closes[index - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))

    average_gain = sum(gains) / period
    average_loss = sum(losses) / period

    for index in range(period + 1, len(closes)):
        delta = closes[index] - closes[index - 1]
        gain = max(delta, 0.0)
        loss = max(-delta, 0.0)
        average_gain = ((average_gain * (period - 1)) + gain) / period
        average_loss = ((average_loss * (period - 1)) + loss) / period

    if average_loss == 0:
        return 100.0

    rs = average_gain / average_loss
    return 100 - (100 / (1 + rs))


def _score_signal(momentum_percent: float, rsi14: float) -> tuple[int, Literal["bearish", "neutral", "bullish"]]:
    # Momentum contributes 70% and RSI contributes 30% of the score.
    momentum_score = max(min(momentum_percent * 3 + 50, 100), 0)
    rsi_score = max(min((rsi14 - 30) * 2.5, 100), 0)
    composite = int(round(momentum_score * 0.7 + rsi_score * 0.3))

    if composite >= 65:
        return composite, "bullish"
    if composite <= 35:
        return composite, "bearish"
    return composite, "neutral"


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/signals/momentum", response_model=SignalResponse)
def build_signal(payload: SignalRequest) -> SignalResponse:
    closes = payload.closes
    if any(price <= 0 for price in closes):
        raise HTTPException(status_code=400, detail="All close prices must be positive numbers")

    latest_close = closes[-1]
    lookback_close = closes[-15]
    momentum_percent = ((latest_close - lookback_close) / lookback_close) * 100

    try:
        rsi14 = _compute_rsi(closes, period=14)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    score, label = _score_signal(momentum_percent=momentum_percent, rsi14=rsi14)

    return SignalResponse(
        ticker=payload.ticker.upper(),
        latest_close=round(latest_close, 4),
        momentum_percent=round(momentum_percent, 2),
        rsi14=round(rsi14, 2),
        score=score,
        label=label,
    )
