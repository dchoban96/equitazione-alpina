import { defineCollection, type SchemaContext } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import yaml from 'js-yaml';

/*
 * Content model. Everything the site shows lives in src/content/ and is
 * validated here, so a future CMS only has to read and write these files.
 * Italian content sits under src/content/it/; another language becomes a
 * sibling folder with the same collections.
 */

const LANG = 'it';
const base = (dir: string) => `./src/content/${LANG}/${dir}`;

export const SECTIONS = [
  'home',
  'equitazione',
  'pastore-del-lagorai',
  'capra-orobica',
  'valtellina',
  'curiosita',
  'info',
  'demo',
] as const;
const section = z.enum(SECTIONS);

/**
 * Optional field that also accepts "" or null as "not set": the admin can
 * save an emptied field that way, and an empty photo path, link or number
 * would otherwise stop the build.
 */
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

/**
 * List files edited in the admin keep their entries under an `items` key.
 * Entries added in the admin have no id: they get one from their position.
 */
const itemsOf = (text: string) =>
  ((yaml.load(text) as { items?: Record<string, unknown>[] }).items ?? []).map((item, i) => ({
    ...item,
    id: item.id ?? `voce-${i + 1}`,
  }));

/** Markdown text. May contain [DA COMPLETARE: ...] markers. */
const rich = z.string();
const labelValue = z.object({ label: z.string(), value: z.string() });

/* ---------- blocks ---------- */

// Fields every block accepts: an altitude in metres (for the altimeter)
// and an anchor id for in-page links.
const common = {
  altitude: opt(z.number().int().min(0).max(4810)),
  anchor: opt(z.string().regex(/^[a-z0-9-]+$/, 'anchor: lowercase letters, digits and dashes only')),
};

// Small label shown beside the kicker ("500 m", "recinto"). When a block has
// an altitude and no note, the altitude is shown here, so it is always
// written in the page text too.
const heading = {
  kicker: z.string().optional(),
  note: z.string().optional(),
  heading: z.string().optional(),
};

const blocks = ({ image }: SchemaContext) => {
  const img = image();
  const block = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('hero'),
      ...common,
      coordinates: z.string().optional(),
      kicker: z.string().optional(),
      title: z.string(),
      intro: rich.optional(),
      closing: z.string().optional(),
      footnote: z.string().optional(),
      image: opt(img),
      imageAlt: z.string().optional(),
      // Silent looping clip played over the image (file under public/, e.g.
      // "/video/intro.mp4"). The image stays as poster and as the fallback
      // without JavaScript or with reduced motion.
      video: opt(
        z.string().regex(/^\/[a-z0-9/_-]+\.(mp4|webm)$/, 'video: a path under public/, e.g. "/video/intro.mp4"'),
      ),
      panelKicker: z.string().optional(),
      panel: z.array(labelValue).optional(),
    }),
    z.object({ type: z.literal('text'), ...common, ...heading, body: rich }),
    z.object({
      type: z.literal('text-image'),
      ...common,
      ...heading,
      body: rich.optional(),
      lead: z.string().optional(),
      image: img,
      alt: z.string().min(1),
      caption: z.string().optional(),
      side: z.enum(['left', 'right', 'below', 'overlay']).default('right'),
      fit: z.enum(['crop', 'contain']).default('crop'),
      details: z.array(labelValue).optional(),
    }),
    z.object({
      type: z.literal('facts'),
      ...common,
      ...heading,
      items: z.array(labelValue).min(1),
    }),
    z.object({
      type: z.literal('cards'),
      ...common,
      ...heading,
      style: z.enum(['tiles', 'cards']).default('tiles'),
      items: z
        .array(
          z.object({
            title: z.string(),
            text: rich.optional(),
            label: z.string().optional(),
            link: z.string().optional(),
            image: opt(img),
            alt: z.string().optional(),
          }),
        )
        .min(1),
    }),
    z.object({
      type: z.literal('places'),
      ...common,
      ...heading,
      items: z
        .array(
          z.object({
            name: z.string(),
            altitude: opt(z.number().int()),
            approximate: z.boolean().default(false),
            text: rich.optional(),
            season: z.string().optional(),
          }),
        )
        .min(1),
    }),
    z.object({ type: z.literal('quote'), ...common, text: z.string(), author: z.string().optional() }),
    z.object({
      type: z.literal('gallery-preview'),
      ...common,
      ...heading,
      gallery: z.string(),
      count: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.number().int().min(4).max(6).default(6)),
      link: z.string().optional(),
    }),
    z.object({ type: z.literal('gallery'), ...common, ...heading, gallery: z.string() }),
    z.object({
      type: z.literal('reviews'),
      ...common,
      ...heading,
      ids: z.array(z.string()).optional(),
      rating: z.string().optional(),
      count: z.string().optional(),
      sourceLabel: z.string().optional(),
      sourceUrl: opt(z.url()),
    }),
    z.object({
      type: z.literal('faq'),
      ...common,
      ...heading,
      tag: z.string().optional(),
      ids: z.array(z.string()).optional(),
    }),
    z.object({
      type: z.literal('curiosity'),
      ...common,
      id: z.string().optional(),
      section: opt(section),
    }),
    z.object({
      type: z.literal('article-list'),
      ...common,
      ...heading,
      section: opt(section),
      count: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.number().int().min(1).max(24).default(3)),
    }),
    z.object({
      type: z.literal('map'),
      ...common,
      ...heading,
      label: z.string(),
      image: img,
      alt: z.string().min(1),
    }),
    z.object({
      type: z.literal('cta-contact'),
      ...common,
      ...heading,
      body: rich.optional(),
      form: z.boolean().default(true),
    }),
  ]);
  // Exactly one H1 per page: every page opens with one hero block.
  return z
    .array(block)
    .min(1)
    .refine((list) => list[0].type === 'hero' && list.filter((b) => b.type === 'hero').length === 1, {
      message: 'blocks: a page starts with exactly one hero block (its title is the H1)',
    });
};

/* ---------- collections ---------- */

const pages = defineCollection({
  // The URL comes from the `slug` field, not from the file name.
  loader: glob({
    pattern: '**/*.yaml',
    base: base('pages'),
    generateId: ({ data }) => String(data.slug || 'index'),
  }),
  schema: (ctx) =>
    z.object({
      slug: z
        .string()
        .regex(/^([a-z0-9-]+(\/[a-z0-9-]+)*)?$/, 'slug: lowercase path without slashes at the ends')
        // the admin leaves empty fields out: no slug means the home page
        .default(''),
      title: z.string(),
      section,
      draft: z.boolean(),
      // Mockup text and illustrations: published, but listed by every build until replaced.
      mockup: z.boolean().default(false),
      noindex: z.boolean().default(false),
      nav: z
        .object({
          label: z.string().optional(),
          order: z.number().default(100),
          hidden: z.boolean().default(false),
        })
        .default({ order: 100, hidden: false }),
      seo: z.object({
        title: z.string().max(60, 'seo.title: at most 60 characters'),
        description: z.string().max(155, 'seo.description: at most 155 characters'),
        image: ctx.image(),
      }),
      localBusiness: z.boolean().default(false),
      headerOverlay: z.boolean().default(false),
      altimeter: z
        .object({
          enabled: z.boolean(),
          min: z.number().int(),
          max: z.number().int(),
        })
        .refine((a) => a.max > a.min, 'altimeter.max must be greater than altimeter.min')
        .optional(),
      blocks: blocks(ctx),
    }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: base('articles') }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      summary: z.string().max(155, 'summary: at most 155 characters (used as meta description)'),
      cover: image(),
      coverAlt: z.string().min(1),
      section,
      draft: z.boolean(),
      mockup: z.boolean().default(false),
      seoTitle: z.string().max(60).optional(),
    }),
});

const curiosities = defineCollection({
  loader: file(`${base('')}curiosities.yaml`, { parser: itemsOf }),
  schema: z.object({ id: z.string(), text: z.string(), sections: z.array(section).min(1) }),
});

const galleries = defineCollection({
  loader: glob({ pattern: '*.yaml', base: base('galleries') }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      section,
      photos: z.array(
        z.object({
          file: image(),
          alt: z.string().min(1, 'every gallery photo needs alt text'),
          caption: z.string().optional(),
          place: z.string().optional(),
          altitude: opt(z.number().int()),
        }),
      ),
    }),
});

const faq = defineCollection({
  loader: file(`${base('')}faq.yaml`, { parser: itemsOf }),
  schema: z.object({
    id: z.string(),
    question: z.string(),
    answer: rich,
    tags: z.array(z.string()).default([]),
  }),
});

const reviews = defineCollection({
  loader: file(`${base('')}reviews.yaml`, { parser: itemsOf }),
  schema: z.object({
    id: z.string(),
    title: z.string().optional(),
    text: z.string(),
    author: z.string(),
    date: z.string(),
    stars: opt(z.number().int().min(1).max(5)),
    sourceUrl: opt(z.url()),
  }),
});

/** Interface strings: button labels, form labels, "quota", "Lo sapevi?"... */
const ui = defineCollection({
  loader: glob({ pattern: 'ui.yaml', base: base('') }),
  schema: z.record(z.string(), z.string()),
});

const site = defineCollection({
  loader: glob({ pattern: 'site.yaml', base: './src/content/settings' }),
  schema: z.object({
    name: z.string(),
    legalName: z.string(),
    vatNumber: z.string(),
    url: z.url(),
    languages: z.array(z.string()).min(1),
    phone: z.string(),
    whatsapp: opt(z.string()),
    email: opt(z.email()),
    address: z.object({
      street: z.string(),
      postalCode: z.string(),
      locality: z.string(),
      province: z.string(),
      country: z.string().length(2),
    }),
    coordinatesText: z.string().optional(),
    geo: z
      .object({ lat: z.number().nullable().default(null), lng: z.number().nullable().default(null) })
      .default({ lat: null, lng: null }),
    hours: z.array(z.object({ days: z.string(), hours: z.string() })).default([]),
    social: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
    menu: z.array(z.string()),
    footer: z.array(z.string()),
    contactForm: z.object({
      action: z.string().default(''),
      reasons: z.array(z.string()).default([]),
    }),
    // Mountains fixed to the bottom of every page, the front ridge over the content.
    ridges: z.boolean().default(true),
    analytics: z.object({
      provider: z.enum(['none', 'ga4']),
      id: z.string().default(''),
    }),
    // Ownership codes from Google Search Console and Bing Webmaster Tools
    // (the content="..." part of their HTML tag). Empty: no tag.
    verification: z
      .object({ google: z.string().default(''), bing: z.string().default('') })
      .default({ google: '', bing: '' }),
  }),
});

const theme = defineCollection({
  loader: glob({ pattern: 'theme.yaml', base: './src/content/settings' }),
  // group -> token name -> CSS value. Each token becomes --<token name>.
  schema: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number()]))),
});

const redirects = defineCollection({
  loader: glob({ pattern: 'redirects.yaml', base: './src/content/settings' }),
  schema: z.object({
    redirects: z.array(
      z.object({
        from: z.string().startsWith('/'),
        to: z.string().startsWith('/'),
      }),
    ),
  }),
});

export const collections = {
  pages,
  articles,
  curiosities,
  galleries,
  faq,
  reviews,
  ui,
  site,
  theme,
  redirects,
};
