// The tour's own vehicle model (tour.config.json `model`: a glTF/GLB under static/, Draco
// compression allowed), loaded once and made ready for the Traveller: normals computed if the
// file has none, stood on the ground (lowest point at y = 0), centred, turned so it faces -z
// (the way the Traveller drives) and sized to `model.length` metres.
import { Box3, BufferGeometry, Mesh, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TOUR } from '$lib/tourConfig';

let loading: Promise<BufferGeometry | null> | null = null;

/** The model's geometry in one piece, or null when the tour has none (or it fails to load). */
export function vehicleGeometry(): Promise<BufferGeometry | null> {
	const cfg = TOUR.model;
	if (!cfg) return Promise.resolve(null);
	return (loading ??= load(cfg).catch((e) => {
		console.warn(`Couldn't load the vehicle model ${cfg.src}:`, e);
		return null;
	}));
}

async function load(cfg: NonNullable<typeof TOUR.model>): Promise<BufferGeometry | null> {
	const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
		import('three/examples/jsm/loaders/GLTFLoader.js'),
		import('three/examples/jsm/loaders/DRACOLoader.js')
	]);
	const draco = new DRACOLoader().setDecoderPath('/draco/'); // three's decoder, served from static/draco
	const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(cfg.src);
	draco.dispose();

	// every mesh, with its place in the file baked in, as one geometry (position + normal only)
	gltf.scene.updateMatrixWorld(true);
	const parts: BufferGeometry[] = [];
	gltf.scene.traverse((o) => {
		if (!(o instanceof Mesh)) return;
		const g = new BufferGeometry();
		g.setAttribute('position', o.geometry.getAttribute('position'));
		if (o.geometry.index) g.setIndex(o.geometry.index);
		const baked = g.applyMatrix4(o.matrixWorld);
		parts.push(baked.index ? baked.toNonIndexed() : baked);
	});
	if (!parts.length) return null;
	const geo = parts.length === 1 ? parts[0] : mergeGeometries(parts);
	if (!geo) return null;

	// face -z: the file's forward axis (default +x) turned onto -z
	const turn = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': Math.PI, '-z': 0 }[cfg.forward ?? '+x'];
	geo.rotateY(turn);
	geo.computeVertexNormals();

	// centred over the origin, wheels on the ground, `length` metres nose to tail
	const box = new Box3().setFromBufferAttribute(geo.getAttribute('position') as never);
	const size = box.getSize(new Vector3());
	const centre = box.getCenter(new Vector3());
	geo.translate(-centre.x, -box.min.y, -centre.z);
	const s = (cfg.length ?? 2) / Math.max(size.z, 1e-6);
	geo.scale(s, s, s);
	return geo;
}
