import { MapRoomDto } from '../../../roborockCommunication/models/home/index.js';

/** Application model: Room with full map context */
export class MapRoom {
  constructor(
    public readonly id: number,
    public readonly globalId: number | undefined,
    public readonly iot_name: string,
    public readonly alternativeId: string,
    public readonly iot_map_id: number | undefined,
  ) {}

  static fromDto(dto: MapRoomDto, iot_name: string): MapRoom {
    return new MapRoom(dto.id, dto.globalId, iot_name, `${dto.id}${dto.tag ?? ''}`, dto.iot_map_id);
  }
}
