// How the tour moves (tour.config.json activity) and the words and numbers that follow from it:
// "Ride here" / "Drive here" / "Walk here", "the bike" / "the car", whether lean means anything,
// and what counts as fast for the speed shading.
import { TOUR } from './tourConfig';

export type Activity = 'motorcycle' | 'bicycle' | 'car' | 'walk';

interface Words {
	/** what moves along the route, with its article: "the bike" */
	mover: string;
	/** one leg of a day: "ride" */
	leg: string;
	/** plural: "rides" */
	legs: string;
	/** the verb, capitalised for buttons: "Ride" ("Ride here") */
	go: string;
	/** a photo taken while stopped: "off the bike" */
	off: string;
	/** leaning into corners is part of it (and the lean readout means something) */
	leans: boolean;
	/** m/s that counts as flat out for the speed shading (motorcycle 28 m/s ≈ 63 mph) */
	fast: number;
	/** single emoji for places where a symbol stands in for it */
	icon: string;
}

const ACTIVITIES: Record<Activity, Words> = {
	motorcycle: { mover: 'the bike', leg: 'ride', legs: 'rides', go: 'Ride', off: 'off the bike', leans: true, fast: 28, icon: '🏍️' },
	bicycle: { mover: 'the bike', leg: 'ride', legs: 'rides', go: 'Ride', off: 'off the bike', leans: true, fast: 12, icon: '🚲' },
	car: { mover: 'the car', leg: 'drive', legs: 'drives', go: 'Drive', off: 'out of the car', leans: false, fast: 33, icon: '🚗' },
	walk: { mover: 'the walker', leg: 'walk', legs: 'walks', go: 'Walk', off: 'on a break', leans: false, fast: 2, icon: '🥾' }
};

export const ACTIVITY: Activity = TOUR.activity in ACTIVITIES ? TOUR.activity : 'motorcycle';
export const A: Words = ACTIVITIES[ACTIVITY];

/** "The bike" */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
