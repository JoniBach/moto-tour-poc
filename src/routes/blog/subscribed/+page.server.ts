// Where Buttondown sends people once they've confirmed their subscription (its
// subscription_confirmation_redirect_url): a welcome, and the newest stories.
import { latestPosts } from '$lib/server/blog-data';

export const load = () => ({ latest: latestPosts(3) });
