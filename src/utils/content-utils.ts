import { type CollectionEntry, getCollection } from "astro:content";
import path from "node:path";
import I18nKey from "@i18n/i18nKey";
import { i18n, isEnglish } from "@i18n/translation";
import { getCanonicalSlug, getCategoryUrl, getDir } from "@utils/url-utils.ts";

export function isEnglishPost(entry: CollectionEntry<"posts">): boolean {
	return (
		isEnglish(entry.data.lang) ||
		entry.id.startsWith("en/") ||
		entry.id.endsWith("/en")
	);
}

export function getPostBasePath(entry: CollectionEntry<"posts">): string {
	if (entry.filePath) {
		return path
			.dirname(entry.filePath)
			.replace(/\\/g, "/")
			.replace(/^src\//, "");
	}
	return path.join("content/posts/", getDir(entry.id));
}

// Retrieve posts for a given locale and sort them by publication date.
// For English ("en"), prefer an English translation with the same canonical slug,
// and fall back to the Chinese original if no translation exists yet.
async function getRawSortedPosts(lang?: string) {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const wantEn = isEnglish(lang);
	const byCanonicalSlug = new Map<string, CollectionEntry<"posts">>();

	for (const post of allBlogPosts) {
		const canonical = getCanonicalSlug(post.id);
		const postIsEn = isEnglishPost(post);

		if (wantEn) {
			const existing = byCanonicalSlug.get(canonical);
			if (!existing || (postIsEn && !isEnglishPost(existing))) {
				byCanonicalSlug.set(canonical, post);
			}
		} else {
			if (!postIsEn) {
				byCanonicalSlug.set(canonical, post);
			}
		}
	}

	const filtered = Array.from(byCanonicalSlug.values());
	const sorted = filtered.sort((a, b) => {
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
}

export async function getSortedPosts(lang?: string) {
	const rawSorted = await getRawSortedPosts(lang);

	// Clone entry data so prev/next metadata for one locale never mutates another
	const sorted = rawSorted.map((entry) => ({
		...entry,
		data: { ...entry.data },
	}));

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = getCanonicalSlug(sorted[i - 1].id);
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = getCanonicalSlug(sorted[i + 1].id);
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}
export type PostForList = {
	slug: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(
	lang?: string,
): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts(lang);

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		slug: getCanonicalSlug(post.id),
		data: post.data,
	}));

	return sortedPostsList;
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(lang?: string): Promise<Tag[]> {
	const allBlogPosts = await getRawSortedPosts(lang);

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(lang?: string): Promise<Category[]> {
	const allBlogPosts = await getRawSortedPosts(lang);
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized, lang);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c, lang),
		});
	}
	return ret;
}
