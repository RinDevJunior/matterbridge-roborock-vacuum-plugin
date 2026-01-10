import { DeviceStatus } from '../../../roborockCommunication/Zmodel/deviceStatus';
import { VacuumErrorCode, DockErrorCode } from '../../../roborockCommunication/Zenum/vacuumAndDockErrorCode';

describe('DeviceStatus model', () => {
  test('parses battery and no-error correctly', () => {
    const msg = [
      {
        msg_ver: 1,
        msg_seq: 1,
        state: 0,
        battery: 75,
        clean_time: 0,
        clean_area: 0,
        error_code: VacuumErrorCode.None,
        map_present: 0,
        in_cleaning: 0,
        in_returning: 0,
        in_fresh_state: 0,
        lab_status: 0,
        water_box_status: 0,
        fan_power: 0,
        dnd_enabled: 0,
        map_status: 0,
        is_locating: 0,
        lock_status: 0,
        water_box_mode: 0,
        distance_off: 0,
        water_box_carriage_status: 0,
        mop_forbidden_enable: 0,
        adbumper_status: [],
        dock_type: 1,
        dust_collection_status: 0,
        auto_dust_collection: 0,
        debug_mode: 0,
        switch_map_mode: 0,
        dock_error_status: DockErrorCode.None,
        charge_status: 0,
      },
    ];

    const ds = new DeviceStatus(msg as any);
    expect(ds.getBattery()).toBe(75);
    expect(ds.getVacuumErrorCode()).toBe(VacuumErrorCode.None);
    expect(ds.getDockErrorCode()).toBe(DockErrorCode.None);
    const dock = ds.getDockInfo();
    expect(dock).toBeDefined();
    expect(ds.errorStatus.hasError()).toBe(false);
  });

  test('recognizes vacuum and dock errors correctly', () => {
    const msg = [
      {
        msg_ver: 1,
        msg_seq: 2,
        state: 0,
        battery: 10,
        clean_time: 0,
        clean_area: 0,
        error_code: VacuumErrorCode.RobotTrapped,
        map_present: 0,
        in_cleaning: 0,
        in_returning: 0,
        in_fresh_state: 0,
        lab_status: 0,
        water_box_status: 0,
        fan_power: 0,
        dnd_enabled: 0,
        map_status: 0,
        is_locating: 0,
        lock_status: 0,
        water_box_mode: 0,
        distance_off: 0,
        water_box_carriage_status: 0,
        mop_forbidden_enable: 0,
        adbumper_status: [],
        dock_type: 1,
        dust_collection_status: 0,
        auto_dust_collection: 0,
        debug_mode: 0,
        switch_map_mode: 0,
        dock_error_status: DockErrorCode.DuctBlockage,
        charge_status: 0,
      },
    ];

    const ds = new DeviceStatus(msg as any);
    expect(ds.getBattery()).toBe(10);
    expect(ds.getVacuumErrorCode()).toBe(VacuumErrorCode.RobotTrapped);
    expect(ds.getDockErrorCode()).toBe(DockErrorCode.DuctBlockage);
    expect(ds.errorStatus.hasError()).toBe(true);
    expect(ds.errorStatus.isStuck()).toBe(true);
    expect(ds.errorStatus.isBinFull()).toBe(true);
  });
});
