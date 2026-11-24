import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { localizePath } from "@utils/url-utils";
import { LinkPreset, type NavBarLink } from "@/types/config";

export function getLinkPresets(
	lang?: string,
): { [key in LinkPreset]: NavBarLink } {
	return {
		[LinkPreset.Home]: {
			name: i18n(I18nKey.home, lang),
			url: localizePath("/", lang),
		},
		[LinkPreset.About]: {
			name: i18n(I18nKey.about, lang),
			url: localizePath("/about/", lang),
		},
		[LinkPreset.Archive]: {
			name: i18n(I18nKey.archive, lang),
			url: localizePath("/archive/", lang),
		},
	};
}

export const LinkPresets: { [key in LinkPreset]: NavBarLink } =
	getLinkPresets();
