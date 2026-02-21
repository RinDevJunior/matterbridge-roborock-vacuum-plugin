# Apple Home RVC Clean Mode Mapping to Roborock Clean Setting

This table shows the mapping between **Apple Home RVC Clean Modes** and the corresponding **Roborock Clean Settings** as defined in `cleanModeConfig.ts`.

| Apple Home RVC Clean Mode (Key) | Apple Home Mode Name            | Roborock Clean Mode | suctionPower (enum value) | waterFlow (enum value) | distance_off | mopRoute (enum value) | sequenceType |
| :-----------------------------: | :------------------------------ | :------------------ | :------------------------ | :--------------------- | :----------: | :-------------------: | :----------: |
|        4 _(smart only)_         | Vacuum & Mop: Automatic         | Smart Plan          | 0                         | 0                      |      0       |      Smart (306)      |   Persist    |
|                5                | Vacuum & Mop: Default           | Vac & Mop           | Balanced (102)            | Medium (202)           |      0       |    Standard (300)     |   Persist    |
|                6                | Vacuum & Mop: Quick             | Vac & Mop           | Balanced (102)            | Medium (202)           |      0       |      Fast (304)       |   Persist    |
|                7                | Vacuum & Mop: Max               | Vac & Mop           | Max (104)                 | Medium (202)           |      0       |    Standard (300)     |   Persist    |
|                8                | Vacuum & Mop: Min               | Vac & Mop           | Balanced (102)            | Low (201)              |      0       |    Standard (300)     |   Persist    |
|                9                | Vacuum & Mop: Quiet             | Vac & Mop           | Quiet (101)               | Medium (202)           |      0       |    Standard (300)     |   Persist    |
|               10                | Vacuum & Mop: Energy Saving     | Custom              | Custom (106)              | Custom (204)           |      0       |     Custom (302)      |   Persist    |
|        11 _(smart only)_        | Vacuum & Mop: Vac Follow by Mop | Vac & Mop           | Balanced (102)            | Low (201)              |      0       |    Standard (300)     |   OneTime    |
|        12 _(smart only)_        | Vacuum & Mop: Deep              | Vac & Mop           | Balanced (102)            | Medium (202)           |      0       |      Deep (301)       |   Persist    |
|               31                | Mop: Default                    | Mop                 | Off (105)                 | Medium (202)           |      0       |    Standard (300)     |   Persist    |
|               32                | Mop: Max                        | Mop                 | Off (105)                 | High (203)             |      0       |    Standard (300)     |   Persist    |
|               33                | Mop: Min                        | Mop                 | Off (105)                 | Low (201)              |      0       |    Standard (300)     |   Persist    |
|               34                | Mop: Quick                      | Mop                 | Off (105)                 | Medium (202)           |      0       |      Fast (304)       |   Persist    |
|               35                | Mop: Deep                       | Mop                 | Off (105)                 | Medium (202)           |      0       |      Deep (301)       |   Persist    |
|               66                | Vacuum: Default                 | Vacuum              | Balanced (102)            | Off (200)              |      0       |    Standard (300)     |   Persist    |
|               67                | Vacuum: Max                     | Vacuum              | Max (104)                 | Off (200)              |      0       |    Standard (300)     |   Persist    |
|               68                | Vacuum: Quiet                   | Vacuum              | Quiet (101)               | Off (200)              |      0       |    Standard (300)     |   Persist    |
|               69                | Vacuum: Quick                   | Vacuum              | Balanced (102)            | Off (200)              |      0       |      Fast (304)       |   Persist    |
|               99                | Vacuum & Mop: Vacation          |                     |                           |                        |              |                       |              |

**Notes:**

- The values in parentheses are enum values from `VacuumSuctionPower`, `MopWaterFlow`, and `MopRoute` in `cleanModeConfig.ts`.
- Keys 4, 11, and 12 are only available on vacuums that support smart mode.
- `sequenceType: OneTime` means the clean sequence runs once and does not persist (used for Vac Follow by Mop).
- Key 11 (Vac Follow by Mop) is a special mode that has not yet been verified from Apple Home — behavior may differ from expectations.
- Key 99 is a special mode used to trigger "go to charge" in Apple Home Automation.
