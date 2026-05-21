# Forecast Page

## What is the Forecast page?

The **Forecast** page gives you a bird's-eye view of your training workload. It answers questions like:

- How many cards do I need to review today, tomorrow, this week?
- Which categories have the most urgent backlog?
- At my current pace, how long will it take to clear the backlog?
- How is my deck split between new, learning, review, and mastered cards?

Navigate to it from the Dashboard → **Forecast** link.

---

## How categories work

Training is organized into **categories** (e.g. "BTN Open", "SB Facing Open"). Each category groups related spots — typically the same strategic situation at different effective-stack depths.

- **BTN Open** = all open-raise spots from BTN at various stack sizes (e.g., 25 BB, 50 BB, 100 BB)
- **SB Facing Open** = all spots where SB faces an open, at different stack sizes

Within a category, each **spot** is a separate 13×13 hand matrix (169 hands). Every hand in every spot has its own independent FSRS scheduling — meaning each hand's review interval, difficulty, and due date are tracked separately. A category with 10 spots has up to 1,690 individual cards.

---

## Pool explanations

Cards are classified into one of five pools based on their FSRS state and recent performance:

| Pool | Description |
|------|-------------|
| **New** | Never seen. Introduced gradually (10–30% of session, depending on problem pressure). |
| **Learning** | Seen 1–3 times. Short intervals (minutes to hours). Still being committed to memory. |
| **Problem** | High error rate or in relearning state. Gets 55% of training attention by default. |
| **Review** | Graduated cards with intervals that grow over time (1 day → weeks → months). |
| **Mastered** | Interval ≥ 14 days with a good streak. Reviewed rarely — long-term retention. |

### Pool weights in training sessions

The trainer uses these default weights when selecting cards:
- **Problem**: 55% of session
- **Learning**: 35% of session
- **Review**: 10% of session

New cards are inserted adaptively: fewer new cards when problem pressure is high, more when the deck is clean.

---

## How to read the forecast

### Due counts

- **Due today** = cards whose FSRS interval has elapsed and need review *right now*. Includes all cards with no `dueAt` timestamp (never seen).
- **Due tomorrow** = all cards due up to end of tomorrow (cumulative).
- **Due this week** = cumulative cards due within the next 7 days.
- **Due this month** = cumulative cards due within the next 30 days.

### Daily forecast bars (14-day chart)

The bar chart shows how many cards are *scheduled* to become due on each day over the next 14 days, broken down by pool:

- 🔵 Blue = Review cards
- 🟡 Yellow = Learning cards
- 🔴 Red = Problem cards
- ⬜ Gray = New cards

This gives you an expected daily load based on current scheduling data. Actual load may vary as you train (completing reviews changes future due dates).

### Per-category breakdown

Each category accordion shows:
- **Spots** — how many 169-hand matrices are in the category
- **Cards** — total active cards in the category
- **Due today / this week** — urgent backlog for that category
- **Pool bar** — visual breakdown of card states
- **Est. daily load** — expected reviews/day from that category at steady state

---

## Backlog management

### Workload estimator

Enter how many cards you can do per day. The estimator tells you:

1. **Net change per day** — positive means backlog shrinks, negative means it grows
2. **Days to clear backlog** — if capacity > daily due, estimates how many days to become current

> If your daily capacity ≤ daily cards due, the backlog will grow indefinitely.

### Steady-state math

At 90% desired retention, review load at full maturity is roughly:

```
reviews/day ≈ active_cards / average_interval_days
```

With 250 matrices (~25,000 active cards) and an average interval of 10 days → ~2,500 reviews/day at full maturity. That's why you should not activate all categories at once.

### Rule of thumb

A deck with **1,000 active review cards** at an average interval of **7 days** produces ~143 reviews/day. This is a comfortable sustainable pace for most people.

---

## Tips for managing your workload

1. **Start with 1 category** — activate one category (e.g., "BTN Open"), reach >50% mastered before adding the next.

2. **Use `focusOnMixedHands`** (Settings) — this suppresses pure-action hands (fold=100%, raise=100%) and focuses on mixed spots (50/50, 75/25). It dramatically reduces active card count while keeping the hardest hands.

3. **Target 100–200 cards/day** — this is a sustainable pace for most players balancing poker study with other activities.

4. **Watch the problem pool** — if the problem pool grows above 20-30% of active cards, the trainer will automatically reduce new card introduction until it drops.

5. **Monitor the 14-day forecast** — if a spike appears (many cards due on one day), consider training more in the days before to spread the load.

6. **One category at a time** — the "Choose training category" view on the Dashboard lets you drill one category per session instead of mixing unrelated spots.

---

## Estimated daily load calculation

For each card in a category, the daily load estimate is:

| Pool | Contribution |
|------|-------------|
| Review / Mastered | `1 / intervalDays` reviews per day |
| Learning | 3 reviews per day |
| Problem | 5 reviews per day |
| New | 0 (not yet in review rotation) |

Summing all contributions gives the expected reviews/day for that category. This is an approximation — actual load depends on your performance and FSRS scheduling.
