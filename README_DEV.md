# How to Implement a New Device

Follow these steps to add support for a new device:

---
## 0. Precondition
- Matterbridge must be run at childbridge mode

## 1. Check the Model

- Open [`src/roborockCommunication/Zmodel/deviceModel.ts`](src/roborockCommunication/Zmodel/deviceModel.ts).
- If your model does not exist, **create a new entry** for it.

---

## 2. Create a New Behavior Folder

- Create a new folder under [`src/behaviors/roborock.vacuum`](src/behaviors/roborock.vacuum) named after the market name of your vacuum.
- Inside this folder:
  - **Create a `initalData.ts` file**  
    _Example:_ [`src/behaviors/roborock.vacuum/smart/initalData.ts`](src/behaviors/roborock.vacuum/smart/initalData.ts)
    This file defines functions that return initial data for your device. (You can inherit from default or create your own)
  - **Create an `runtimes.ts` file**  
  _Example:_ [`src/behaviors/roborock.vacuum/smart/runtimes.ts`](src/behaviors/roborock.vacuum/smart/runtimes.ts)
    In case you define your own initial data. Create new method that override the default method.
  - **Create an `abcyxz.ts` file**  
  _Example:_ [`src/behaviors/roborock.vacuum/smart/smart.ts`](src/behaviors/roborock.vacuum/smart/smart.ts)
    Define matterbridge command handler logic to sending requests to control your vacuum (start, pause, resume, go home, etc.).
    (Use in step 4)

---

## 3. Register Your Initial Functions

- Add your initial functions to the following files:
  - [`src/initialData/getSupportedCleanModes.ts`](src/initialData/getSupportedCleanModes.ts)
  - [`src/initialData/getSupportedRunModes.ts`](src/initialData/getSupportedRunModes.ts)
  - [`src/initialData/getOperationalStates.ts`](src/initialData/getOperationalStates.ts)

***_In somecase, you may need to update whole function to support switch case_***
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

## 9. Build package
```sh
cd .. && tar -czvf matterbridge-roborock-vacuum-plugin-1.0.1-rc02.tgz matterbridge-roborock-vacuum-plugin && cd matterbridge-roborock-vacuum-plugin
```