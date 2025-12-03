
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/collections" | "/login" | "/products" | "/signup" | "/variants";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/collections": Record<string, never>;
			"/login": Record<string, never>;
			"/products": Record<string, never>;
			"/signup": Record<string, never>;
			"/variants": Record<string, never>
		};
		Pathname(): "/" | "/collections" | "/collections/" | "/login" | "/login/" | "/products" | "/products/" | "/signup" | "/signup/" | "/variants" | "/variants/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/logo.svg" | string & {};
	}
}