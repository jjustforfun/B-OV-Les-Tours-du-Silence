/**
 * Rival.ts — l'autre bâtisseur du chapitre du pardon.
 *
 * Il ne copie pas Turpal et ne reçoit aucun ordre direct. Quand Turpal avance
 * le premier, il répond par un geste de paume puis fait pivoter sa moitié de
 * tour. Sa silhouette rouille reste digne, sans arme ni signe d'affrontement.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
} from 'three';
import type { NavGraph, NodeId } from '@world/NavGraph';
import { disposeObject } from '@utils/dispose';

const RESPONSE_SECONDS = 1.35;
const RECONCILIATION_SECONDS = 3.2;

export class Rival {
  readonly root = new Group();

  private readonly body = new Group();
  private readonly head = new Group();
  private readonly rightArm = new Group();
  private readonly rightForearm = new Group();
  private elapsed = 0;
  private responseElapsed = RESPONSE_SECONDS;
  private reconciliationElapsed = RECONCILIATION_SECONDS;

  constructor() {
    this.root.name = 'Actor:Rival';
    this.buildModel();
  }

  placeAt(graph: NavGraph, nodeId: NodeId): void {
    const node = graph.getNode(nodeId);
    if (node === undefined) return;
    this.root.position.set(node.position.x, node.position.y, node.position.z);
  }

  /** Réponse à la paume tendue de Turpal, juste avant la rotation orientale. */
  respond(): void {
    this.responseElapsed = 0;
  }

  /** La dernière rotation devient un salut tenu, sans triomphe ni texte. */
  reconcile(): void {
    this.reconciliationElapsed = 0;
    this.responseElapsed = 0;
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.responseElapsed = Math.min(RESPONSE_SECONDS, this.responseElapsed + delta);
    this.reconciliationElapsed = Math.min(
      RECONCILIATION_SECONDS,
      this.reconciliationElapsed + delta,
    );

    const breath = Math.sin(this.elapsed * 1.7);
    this.body.position.y = breath * 0.012;
    this.head.rotation.y = Math.sin(this.elapsed * 0.37) * 0.055;

    const responsePhase = Math.sin(Math.min(1, this.responseElapsed / RESPONSE_SECONDS) * Math.PI);
    const heldGreeting =
      this.reconciliationElapsed < RECONCILIATION_SECONDS
        ? Math.sin(Math.min(1, this.reconciliationElapsed / RECONCILIATION_SECONDS) * Math.PI)
        : 0;
    const gesture = Math.max(responsePhase, heldGreeting);
    this.rightArm.rotation.x = -1.08 * gesture;
    this.rightArm.rotation.z = -0.38 * gesture;
    this.rightForearm.rotation.x = -0.42 * gesture;
    this.head.rotation.x = 0.1 * gesture;
  }

  dispose(): void {
    disposeObject(this.root);
  }

  private buildModel(): void {
    const coat = new MeshToonMaterial({ color: 0x5f372b });
    const coatEdge = new MeshToonMaterial({ color: 0x35241f });
    const silver = new MeshToonMaterial({ color: 0x9f9a91 });
    const skin = new MeshToonMaterial({ color: 0x9c765f });
    const hat = new MeshToonMaterial({ color: 0x554943 });

    const torso = new Mesh(new CapsuleGeometry(0.2, 0.58, 3, 7), coat);
    torso.position.y = 0.9;
    this.body.add(torso);

    const skirt = new Mesh(new CylinderGeometry(0.21, 0.31, 0.66, 7), coat);
    skirt.position.y = 0.56;
    this.body.add(skirt);

    const belt = new Mesh(new CylinderGeometry(0.22, 0.22, 0.055, 8), coatEdge);
    belt.position.y = 0.78;
    this.body.add(belt);

    for (const side of [-1, 1]) {
      for (let index = 0; index < 4; index += 1) {
        const gazyr = new Mesh(new BoxGeometry(0.025, 0.13, 0.025), silver);
        gazyr.position.set(side * (0.055 + index * 0.035), 1.06, 0.185);
        gazyr.rotation.z = side * 0.08;
        this.body.add(gazyr);
      }
    }

    const face = new Mesh(new SphereGeometry(0.155, 9, 6), skin);
    face.position.y = 1.4;
    this.head.add(face);
    const papakha = new Mesh(new CylinderGeometry(0.18, 0.16, 0.25, 9), hat);
    papakha.position.y = 1.59;
    this.head.add(papakha);
    this.body.add(this.head);

    const leftArm = new Group();
    leftArm.position.set(-0.23, 1.13, 0);
    const leftSleeve = new Mesh(new CapsuleGeometry(0.055, 0.4, 3, 6), coat);
    leftSleeve.position.y = -0.22;
    leftArm.add(leftSleeve);
    this.body.add(leftArm);

    this.rightArm.position.set(0.23, 1.13, 0);
    const rightSleeve = new Mesh(new CapsuleGeometry(0.055, 0.34, 3, 6), coat);
    rightSleeve.position.y = -0.19;
    this.rightArm.add(rightSleeve);
    this.rightForearm.position.set(0, -0.39, 0);
    const forearm = new Mesh(new CapsuleGeometry(0.05, 0.28, 3, 6), coat);
    forearm.position.y = -0.16;
    const palm = new Mesh(new SphereGeometry(0.065, 7, 5), skin);
    palm.position.y = -0.35;
    this.rightForearm.add(forearm, palm);
    this.rightArm.add(this.rightForearm);
    this.body.add(this.rightArm);

    for (const side of [-1, 1]) {
      const leg = new Mesh(new CapsuleGeometry(0.06, 0.38, 3, 6), coatEdge);
      leg.position.set(side * 0.11, 0.24, 0);
      this.body.add(leg);
    }

    this.root.add(this.body);
    this.root.scale.setScalar(0.92);
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = false;
    });
  }
}
