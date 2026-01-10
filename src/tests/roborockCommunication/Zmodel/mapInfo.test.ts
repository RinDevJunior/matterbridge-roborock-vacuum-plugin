import { MapInfo } from '../../../roborockCommunication/Zmodel/mapInfo';

describe('MapInfo parsing', () => {
  test('constructs maps and rooms from multipleMap', () => {
    const multimap: any = {
      map_info: [
        {
          mapFlag: 1,
          name: 'Home%20Map',
          rooms: [
            { id: 10, iot_name_id: '100', tag: 0, iot_name: 'Kitchen' },
            { id: 11, iot_name_id: '101', tag: 0, iot_name: 'Living' },
          ],
        },
      ],
    };

    const mi = new MapInfo(multimap);
    expect(mi.maps.length).toBe(1);
    expect(mi.getById(1)).toBeDefined();
    expect(mi.getByName('Home Map')).toBe(1);
    expect(mi.allRooms.length).toBe(2);
  });

  test('handles empty rooms gracefully', () => {
    const multimap: any = { map_info: [{ mapFlag: 2, name: 'Empty%20Map' }] };
    const mi = new MapInfo(multimap);
    expect(mi.maps.length).toBe(1);
    expect(mi.allRooms.length).toBe(0);
  });
});
