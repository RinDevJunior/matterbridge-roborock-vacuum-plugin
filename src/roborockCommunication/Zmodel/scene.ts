export class Scene {
  id: number | undefined;
  name: string | undefined;
  param: string | undefined;
  enabled: boolean | undefined;
  extra: any | undefined;
  type: string | undefined;
}

export interface SceneParam {
  triggers: any[];
  action: {
    type: string;
    items: SceneItem[];
  };
  matchType: string;
}

export class SceneItem {
  id: number | undefined;
  type: string | undefined;
  name: string | undefined;
  entityId: string | undefined;
  param: SceneCommand | undefined;
  finishDpIds: number[] | undefined;
}

export interface SceneCommand {
  id: number;
  method: string;
  params: SceneCommandParam[];
}

export interface SceneCommandParam {
  fan_power: number;
  water_box_mode: number;
  mop_mode: number;
  mop_template_id: number;
  repeat: number;
  auto_dustCollection: number;
  source: number;
}
