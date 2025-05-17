# How to Implement a New Device

Follow these steps to add support for a new device:

---

## 1. Check the Model

- Open [`src/roborock/features/DeviceModel.ts`](src/roborock/features/DeviceModel.ts).
- If your model does not exist, **create a new entry** for it.

---

## 2. Create a New Behavior Folder

- Create a new folder under [`src/behaviors/roborock.vacuum`](src/behaviors/roborock.vacuum) named after the market name of your vacuum.
- Inside this folder:
  - **Create a `model.ts` file**  
    _Example:_ [`src/behaviors/roborock.vacuum/QREVO_EDGE_5V1/a187.ts`](src/behaviors/roborock.vacuum/QREVO_EDGE_5V1/a187.ts)  
    This file handles sending requests to control your vacuum (start, pause, resume, go home, etc.).
  - **Create an `initalData.ts` file**  
    This file defines functions that return initial data for your device.

---

## 3. Register Your Initial Functions

- Add your initial functions to the following files:
  - [`src/initialData/getOperationalStates.ts`](src/initialData/getOperationalStates.ts)
  - [`src/initialData/getSupportedCleanModes.ts`](src/initialData/getSupportedCleanModes.ts)
  - [`src/initialData/getSupportedRunModes.ts`](src/initialData/getSupportedRunModes.ts)

---

## 4. Update the Behavior Factory

- Add a new `switch` case to [`src/behaviorFactory.ts`](src/behaviorFactory.ts).
  - This is where you set the behavior handler for your device.

---

## 5. Build and Run

```sh
sudo npm run precondition
sudo npm run deepCleanBuild
sudo npm run matterbridge:add
sudo npm run start:roborock
```
---

## 6. Current issue
- Device show twice in Apple Home
- Device information shows incorrectly in Apple Home (Device name, firmware ....)
- Play Sound to Locate (Apple Home) not working
- Showing wrong location during opration

## 7. Not Tested
- Clean selected room

## 8. TODO
- correct state_to_matter_state