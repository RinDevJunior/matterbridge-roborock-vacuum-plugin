# Apple Home RVC Clean Mode Mapping to Roborock Clean Setting

This table shows the mapping between **Apple Home RVC Clean Modes** and the corresponding **Roborock Clean Settings** as defined in `smart.ts` and `default.ts`.

| Apple Home RVC Clean Mode (Key) | Apple Home Mode Name         | Roborock Clean Mode | suctionPower (enum value) | waterFlow (enum value) | distance_off | mopRoute (enum value) |
|:-------------------------------:|:-----------------------------|:--------------------|:--------------------------|:----------------------|:------------:|:---------------------:|
| 4 *(smart only)*                | Mop & Vacuum: Automatic      | Smart Plan          | 0                         | 0                     | 0            | Smart (306)           |
| 5                               | Mop & Vacuum: Day (Automatic)| Vac & Mop           | Balanced (102)            | Medium (202)          | 0            | Standard (300)        |
| 6                               | Mop & Vacuum: Quick          | Vac & Mop           | Balanced (102)            | Medium (202)          | 0            | Fast (304)            |
| 7                               | Mop & Vacuum: Max            | Vac & Mop           | Max (104)                 | Medium (202)          | 0            | Standard (300)        |
| 8                               | Mop & Vacuum: Min            | Vac & Mop           | Balanced (102)            | Low (201)             | 0            | Standard (300)        |
| 9                               | Mop & Vacuum: Quiet          | Vac & Mop           | Quiet (101)               | Medium (202)          | 0            | Standard (300)        |
| 10                              | Mop & Vacuum: LowEnergy      | Custom              | Custom (106)              | Custom (204)          | 0            | Custom (302)          |
| 31                              | Mop: Default                 | Mop                 | Off (105)                 | Medium (202)          | 0            | Standard (300)        |
| 32                              | Mop: Max                     | Mop                 | Off (105)                 | High (203)            | 0            | Standard (300)        |
| 33                              | Mop: Min                     | Mop                 | Off (105)                 | Low (201)             | 0            | Standard (300)        |
| 34                              | Mop: Quick                   | Mop                 | Off (105)                 | Medium (202)          | 0            | Fast (304)            |
| 35                              | Mop: DeepClean               | Mop                 | Off (105)                 | Medium (202)          | 0            | Deep (301)            |
| 66                              | Vacuum: Default              | Vacuum              | Balanced (102)            | Off (200)             | 0            | Standard (300)        |
| 67                              | Vacuum: Max                  | Vacuum              | Max (104)                 | Off (200)             | 0            | Standard (300)        |
| 68                              | Vacuum: Quiet                | Vacuum              | Quiet (101)               | Off (200)             | 0            | Standard (300)        |
| 69                              | Vacuum: Quick                | Vacuum              | Balanced (102)            | Off (200)             | 0            | Fast (304)            |
| 99                              | Mop & Vacuum: Vacation       |                     |                           |                       |              |                       |

**Notes:**
- The values in parentheses are enum values from `VacuumSuctionPowerSmart`/`VacuumSuctionPower`, `MopWaterFlowSmart`/`MopWaterFlow`, and `MopRouteSmart`/`MopRoute` in `smart.ts` and `default.ts`.
- Key 4 ("Smart Plan") is only available on some new vacuums.
- This mapping helps you understand how Apple Home clean modes correspond to Roborock's internal cleaning settings for both "smart" and "default" behaviors.
- Key 99 is a tricky mode to support go to charge in Apple Home Automation