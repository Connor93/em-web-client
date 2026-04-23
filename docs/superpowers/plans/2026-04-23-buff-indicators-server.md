# Buff/Debuff Indicators — Server Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `[TAG]` status messages for all class ability buffs/debuffs so the web client can display indicators.

**Architecture:** Add broadcast status messages at each buff apply point in `map.cpp` and expiry point in `character.cpp`. Follow the existing `[SHIELD]`/`[HOT]` pattern — human-readable text with a parseable tag prefix, broadcast to all map players.

**Tech Stack:** C++17, etheos game server

**Spec:** `docs/superpowers/specs/2026-04-23-buff-debuff-indicators-design.md`

**Server repo:** `/Users/cfraser/Projects/etheos/`

---

### Task 1: Add stat buff apply messages (SpellSelf)

**Files:**
- Modify: `../etheos/src/map.cpp` (SpellSelf stat buff section, around line 2095-2160)

The stat buff section handles War Cry, Fortify, Evasion, and Arcane Intellect. After the buff is applied and the spell packet is sent, add a broadcast status message identifying the buff type by spell ID.

- [ ] **Step 1: Add a buff-type lookup and broadcast message after stat buff application**

In `map.cpp`, find the SpellSelf stat buff section. After the `from->Send(builder)` call (around line 2160), before the cooldown check, add:

```cpp
      // Broadcast buff indicator message
      {
        std::string buff_tag;
        std::string buff_desc;
        // Build description from all stat:amount pairs
        std::string stats_desc;
        for (std::size_t si = 1; si + 1 < parts.size(); si += 2) {
          if (si + 1 >= parts.size() - 1) break;
          std::string s = parts[si];
          int base_amt = util::to_int(parts[si + 1]);
          int amt = static_cast<int>(base_amt * (1.0 + double(from->SpellLevel(spell_id)) / 100.0));
          amt = std::max(amt, 1);
          if (!stats_desc.empty()) stats_desc += "/";
          stats_desc += "+" + util::to_string(amt) + " " + s;
        }

        if (spell_id == 41) { buff_tag = "WARCRY"; }
        else if (spell_id == 42) { buff_tag = "FORTIFY"; }
        else if (spell_id == 46) { buff_tag = "EVASION"; }
        else if (spell_id == 54) { buff_tag = "ARCANE_INT"; }
        else { buff_tag = "BUFF"; }

        std::string msg = "[" + buff_tag + "] " +
            util::to_string(static_cast<short>(from->PlayerID())) +
            " " + from->SourceName() + ": " + stats_desc +
            " (" + util::to_string(static_cast<int>(duration)) + "s)";
        PacketBuilder buff_msg(PACKET_MESSAGE, PACKET_OPEN, msg.length());
        buff_msg.AddString(msg);
        UTIL_FOREACH(this->characters, c) { c->Send(buff_msg); }
      }
```

- [ ] **Step 2: Verify build**

```bash
cd ../etheos && cmake --build build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd ../etheos && git add src/map.cpp && git commit -m "feat: add stat buff indicator messages (warcry, fortify, evasion, arcane int)"
```

---

### Task 2: Add damage reduction, lifesteal, mana shield apply messages

**Files:**
- Modify: `../etheos/src/map.cpp` (SpellSelf sections for damage reduction ~2174, lifesteal ~2219, mana shield ~2264)

Each of these already has a `StatusMsg()` call. Replace the single-player StatusMsg with a map-wide broadcast using the `[TAG]` format.

- [ ] **Step 1: Replace damage reduction StatusMsg with broadcast**

In `map.cpp` around line 2188, replace:
```cpp
from->StatusMsg("Damage reduced by " + util::to_string(static_cast<int>(percent)) + "% for " + util::to_string(static_cast<int>(duration)) + "s.");
```

With:
```cpp
      {
        std::string msg = "[DIVINE_PROT] " +
            util::to_string(static_cast<short>(from->PlayerID())) +
            " " + from->SourceName() + ": " +
            util::to_string(static_cast<int>(percent)) +
            "% damage reduction (" +
            util::to_string(static_cast<int>(duration)) + "s)";
        PacketBuilder buff_msg(PACKET_MESSAGE, PACKET_OPEN, msg.length());
        buff_msg.AddString(msg);
        UTIL_FOREACH(this->characters, c) { c->Send(buff_msg); }
      }
```

- [ ] **Step 2: Replace lifesteal StatusMsg with broadcast**

In `map.cpp` around line 2234, replace:
```cpp
from->StatusMsg("Lifesteal active for " + util::to_string(static_cast<int>(duration)) + "s.");
```

With:
```cpp
      {
        std::string msg = "[BLOODLUST] " +
            util::to_string(static_cast<short>(from->PlayerID())) +
            " " + from->SourceName() + ": " +
            util::to_string(static_cast<int>(percent)) +
            "% lifesteal (" +
            util::to_string(static_cast<int>(duration)) + "s)";
        PacketBuilder buff_msg(PACKET_MESSAGE, PACKET_OPEN, msg.length());
        buff_msg.AddString(msg);
        UTIL_FOREACH(this->characters, c) { c->Send(buff_msg); }
      }
```

- [ ] **Step 3: Replace mana shield StatusMsg with broadcast**

In `map.cpp` around line 2278, replace:
```cpp
from->StatusMsg("Mana Shield active for " + util::to_string(static_cast<int>(duration)) + "s.");
```

With:
```cpp
      {
        std::string msg = "[MANA_SHIELD] " +
            util::to_string(static_cast<short>(from->PlayerID())) +
            " " + from->SourceName() + ": Mana Shield active (" +
            util::to_string(static_cast<int>(duration)) + "s)";
        PacketBuilder buff_msg(PACKET_MESSAGE, PACKET_OPEN, msg.length());
        buff_msg.AddString(msg);
        UTIL_FOREACH(this->characters, c) { c->Send(buff_msg); }
      }
```

- [ ] **Step 4: Verify build**

```bash
cd ../etheos && cmake --build build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd ../etheos && git add src/map.cpp && git commit -m "feat: add divine protection, bloodlust, mana shield indicator messages"
```

---

### Task 3: Add priest blessing apply messages (SpellGroup)

**Files:**
- Modify: `../etheos/src/map.cpp` (SpellGroup stat buff section, around line 3171-3225)

Priest blessings (STR=57, WIS=58, AGI=59) use SpellGroup and apply to party members. Add a broadcast after each member receives the buff.

- [ ] **Step 1: Add broadcast message after the SpellGroup stat buff loop**

In `map.cpp`, find the SpellGroup stat buff section. After the `member->Effect(effect_id - 1)` block (around line 3223), still inside the `UTIL_FOREACH(spell_targets, member)` loop, add:

```cpp
        // Broadcast blessing indicator message
        {
          std::string buff_tag;
          std::string stats_desc;
          for (std::size_t si = 1; si + 1 < parts.size(); si += 2) {
            if (si + 1 >= parts.size() - 1) break;
            std::string s = parts[si];
            int base_amt = util::to_int(parts[si + 1]);
            int amt = static_cast<int>(base_amt * (1.0 + double(from->SpellLevel(spell_id)) / 100.0));
            amt = std::max(amt, 1);
            if (from->healing_power > 0) {
              amt = static_cast<int>(amt * (1.0 + from->healing_power / 100.0));
            }
            if (!stats_desc.empty()) stats_desc += "/";
            stats_desc += "+" + util::to_string(amt) + " " + s;
          }

          if (spell_id == 57) { buff_tag = "BLESS_STR"; }
          else if (spell_id == 58) { buff_tag = "BLESS_WIS"; }
          else if (spell_id == 59) { buff_tag = "BLESS_AGI"; }
          else { buff_tag = "BLESSING"; }

          std::string msg = "[" + buff_tag + "] " +
              util::to_string(static_cast<short>(member->PlayerID())) +
              " " + member->SourceName() + ": " + stats_desc +
              " (" + util::to_string(static_cast<int>(duration)) + "s)";
          PacketBuilder buff_msg(PACKET_MESSAGE, PACKET_OPEN, msg.length());
          buff_msg.AddString(msg);
          UTIL_FOREACH(this->characters, c) { c->Send(buff_msg); }
        }
```

- [ ] **Step 2: Verify build**

```bash
cd ../etheos && cmake --build build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd ../etheos && git add src/map.cpp && git commit -m "feat: add priest blessing indicator messages (str, wis, agi)"
```

---

### Task 4: Add NPC debuff apply messages

**Files:**
- Modify: `../etheos/src/map.cpp` (SpellAttack debuff section, around line 2617-2652)

NPC debuffs (Weaken=49 damage_reduce, Hunter's Mark=47 vulnerability, Amplify=55 spell_vulnerability). Add a broadcast after the debuff is applied.

- [ ] **Step 1: Add broadcast message after NPC debuff application**

In `map.cpp`, find the SpellAttack debuff section. After the effect packet send block (around line 2648), before `amount = 1`, add:

```cpp
      // Broadcast NPC debuff indicator message
      {
        std::string debuff_tag;
        std::string debuff_desc;
        if (type == "damage_reduce") {
          debuff_tag = "WEAKEN";
          debuff_desc = "-" + util::to_string(static_cast<int>(percent)) + "% damage";
        } else if (type == "vulnerability") {
          debuff_tag = "HUNTERS_MARK";
          debuff_desc = "Vulnerable";
        } else if (type == "spell_vulnerability") {
          debuff_tag = "AMPLIFY";
          debuff_desc = "Spell Vulnerable";
        }

        if (!debuff_tag.empty()) {
          std::string npc_name = npc->ENFData().name;
          std::string msg = "[" + debuff_tag + "] " +
              util::to_string(npc->index) + " " + npc_name + ": " +
              debuff_desc + " (" +
              util::to_string(static_cast<int>(duration)) + "s)";
          PacketBuilder debuff_msg(PACKET_MESSAGE, PACKET_OPEN, msg.length());
          debuff_msg.AddString(msg);
          UTIL_FOREACH(this->characters, c) { c->Send(debuff_msg); }
        }
      }
```

- [ ] **Step 2: Verify build**

```bash
cd ../etheos && cmake --build build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd ../etheos && git add src/map.cpp && git commit -m "feat: add NPC debuff indicator messages (weaken, hunters mark, amplify)"
```

---

### Task 5: Add buff expiry messages

**Files:**
- Modify: `../etheos/src/character.cpp` (UpdateBuffs, around line 2622-2688)

Replace the existing single-player StatusMsg expiry calls with map-wide broadcast `[TAG_END]` messages.

- [ ] **Step 1: Add tagged expiry messages for stat buffs**

In `character.cpp`, in the `UpdateBuffs()` function, the stat buff expiry section (lines 2626-2645) erases expired buffs then sends a generic "Buff expired" message. Replace the expiry message block (lines 2635-2644) with:

```cpp
  if (changed) {
    this->CalculateStats();
    this->SendStatsToClient();
    // Broadcast expiry for each expired buff by checking which are gone
    if (this->map) {
      // We can't easily know which specific buff expired from inside the loop,
      // so send a generic buff end that the client can match by checking its own state
      std::string msg = "[BUFF_END] " +
          util::to_string(static_cast<short>(this->PlayerID())) +
          " " + this->SourceName() + ": Buff expired";
      PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
      builder.AddString(msg);
      UTIL_FOREACH(this->map->characters, c) { c->Send(builder); }
    }
  }
```

- [ ] **Step 2: Replace damage reduction expiry with broadcast**

In `character.cpp` around line 2665-2668, replace:
```cpp
    this->StatusMsg("Damage reduction expired.");
```

With:
```cpp
    if (this->map) {
      std::string msg = "[DIVINE_PROT_END] " +
          util::to_string(static_cast<short>(this->PlayerID())) +
          " " + this->SourceName() + ": Divine Protection expired";
      PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
      builder.AddString(msg);
      UTIL_FOREACH(this->map->characters, c) { c->Send(builder); }
    }
```

- [ ] **Step 3: Replace mana shield expiry with broadcast**

In `character.cpp` around line 2671-2674, replace:
```cpp
    this->StatusMsg("Mana Shield expired.");
```

With:
```cpp
    if (this->map) {
      std::string msg = "[MANA_SHIELD_END] " +
          util::to_string(static_cast<short>(this->PlayerID())) +
          " " + this->SourceName() + ": Mana Shield expired";
      PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
      builder.AddString(msg);
      UTIL_FOREACH(this->map->characters, c) { c->Send(builder); }
    }
```

- [ ] **Step 4: Replace lifesteal expiry with broadcast**

In `character.cpp` around line 2677-2680, replace:
```cpp
    this->StatusMsg("Lifesteal expired.");
```

With:
```cpp
    if (this->map) {
      std::string msg = "[BLOODLUST_END] " +
          util::to_string(static_cast<short>(this->PlayerID())) +
          " " + this->SourceName() + ": Bloodlust expired";
      PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
      builder.AddString(msg);
      UTIL_FOREACH(this->map->characters, c) { c->Send(builder); }
    }
```

- [ ] **Step 5: Replace EXP bonus expiry with broadcast**

In `character.cpp` around line 2683-2686, replace:
```cpp
    this->StatusMsg("EXP bonus expired.");
```

With:
```cpp
    if (this->map) {
      std::string msg = "[DIVINE_INSP_END] " +
          util::to_string(static_cast<short>(this->PlayerID())) +
          " " + this->SourceName() + ": Divine Inspiration expired";
      PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
      builder.AddString(msg);
      UTIL_FOREACH(this->map->characters, c) { c->Send(builder); }
    }
```

- [ ] **Step 6: Verify build**

```bash
cd ../etheos && cmake --build build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
cd ../etheos && git add src/character.cpp && git commit -m "feat: broadcast buff expiry messages for all class ability buffs"
```

---

### Task 6: Add NPC debuff expiry messages

**Files:**
- Modify: `../etheos/src/npc.cpp` or wherever NPC debuff timers are checked

NPC debuffs expire when their timer runs out. The damage calculation code checks `Timer::GetTime() < npc->vulnerability_until` etc. We need to find where expired debuffs are cleaned up and add expiry messages.

- [ ] **Step 1: Find the NPC debuff expiry location**

Search for where `damage_debuff_until`, `vulnerability_until`, or `spell_vulnerability_until` are checked and cleared. This might be in `npc.cpp` in a tick/update function, or it might only be checked at damage time (meaning there's no explicit expiry — it just stops applying).

If there's no explicit expiry cleanup, add one in the NPC's tick function:

```cpp
// In NPC::Act() or similar tick function
if (this->damage_debuff_pct > 0.0 && Timer::GetTime() >= this->damage_debuff_until) {
  this->damage_debuff_pct = 0.0;
  this->damage_debuff_until = 0.0;
  if (this->map) {
    std::string msg = "[WEAKEN_END] " + util::to_string(this->index) + ": Weaken expired";
    PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
    builder.AddString(msg);
    UTIL_FOREACH(this->map->characters, c) { c->Send(builder); }
  }
}

if (this->vulnerability_pct > 0.0 && Timer::GetTime() >= this->vulnerability_until) {
  this->vulnerability_pct = 0.0;
  this->vulnerability_until = 0.0;
  if (this->map) {
    std::string msg = "[HUNTERS_MARK_END] " + util::to_string(this->index) + ": Hunter's Mark expired";
    PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
    builder.AddString(msg);
    UTIL_FOREACH(this->map->characters, c) { c->Send(builder); }
  }
}

if (this->spell_vulnerability_pct > 0.0 && Timer::GetTime() >= this->spell_vulnerability_until) {
  this->spell_vulnerability_pct = 0.0;
  this->spell_vulnerability_until = 0.0;
  if (this->map) {
    std::string msg = "[AMPLIFY_END] " + util::to_string(this->index) + ": Amplify Magic expired";
    PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
    builder.AddString(msg);
    UTIL_FOREACH(this->map->characters, c) { c->Send(builder); }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd ../etheos && cmake --build build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd ../etheos && git add src/npc.cpp && git commit -m "feat: add NPC debuff expiry broadcast messages"
```
