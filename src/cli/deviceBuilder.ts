import { DeviceCategory } from '../roborockCommunication/models/deviceCategory.js';
import { DeviceModel } from '../roborockCommunication/models/deviceModel.js';
import { Device, DeviceInformation, DeviceSpecs, Home, UserData } from '../roborockCommunication/models/index.js';
import { Protocol } from '../roborockCommunication/models/protocol.js';
import { SceneParam } from '../roborockCommunication/models/scene.js';

export function buildDevices(homeData: Home, homeId: number, userData: UserData): Device[] {
	const products = new Map<string, { model: DeviceModel; category: DeviceCategory }>();
	homeData.products.forEach((p) =>
		products.set(p.id, { model: p.model as DeviceModel, category: p.category as DeviceCategory }),
	);

	return [...homeData.devices, ...homeData.receivedDevices].map((device) => ({
		...device,
		rrHomeId: homeId,
		serialNumber: device.sn,
		scenes: (device.scenes ?? []).filter(
			(sc) => sc.param && (JSON.parse(sc.param) as SceneParam).action.items.some((x) => x.entityId === device.duid),
		),
		specs: {
			id: device.duid,
			firmwareVersion: device.fv,
			serialNumber: device.sn,
			model: products.get(device.productId)?.model as DeviceModel,
			protocol: device.pv,
			category: products.get(device.productId)?.category as DeviceCategory,
			batteryLevel: Number(device.deviceStatus?.[Protocol.battery] ?? 100),
			hasRealTimeConnection: false,
		} satisfies DeviceSpecs,
		store: {
			userData,
			localKey: device.localKey,
			pv: device.pv,
			model: products.get(device.productId)?.model as DeviceModel,
			homeData,
		} satisfies DeviceInformation,
	})) satisfies Device[];
}
