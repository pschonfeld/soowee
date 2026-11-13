# Tiramisu - refinement report (Pro Home)

## Diagnosis

The original has the right ingredients and the right flavour idea - espresso, Savoiardi, mascarpone, cocoa - and its dipping advice (1–2 seconds a side) is spot on. What holds it back is construction and quantity: it splits the eggs into two separate mascarpone creams and layers them apart, which is not how tiramisu is built and gives two weaker layers instead of one stable, airy cream. Its amounts also only cover about half the dish it promises: 100 g of biscuits is roughly 12 Savoiardi, not enough for one full layer, let alone two for 8 servings. Despite the "authentic" label, the dish it should be is one aerated mascarpone cream over two layers of coffee-soaked biscuits.

## Key changes (ranked by impact)

1. **One cream, not two** *(if you change only these)* - yolk cream and white cream layered separately → yolks + sugar + mascarpone made into one cream, whipped whites folded in last, the same cream used for both layers. Folded-in egg whites lighten and stabilise the whole cream: their protein foam holds air through the fat of the mascarpone. Kept apart, the white layer is an unstable, watery foam and the yolk layer is dense and heavy. *(technique, identity)*
2. **Quantities that actually fill the dish** *(if you change only these)* - 2 eggs / 250 g mascarpone / 100 g biscuits for "8 servings" → 4 eggs / 500 g mascarpone / 300 g biscuits / 100 g sugar, in a stated 20 × 25 cm dish. Arithmetic: ~8 g per biscuit, so 100 g ≈ 12 biscuits, while one layer in this dish needs about 18. Now: 300 g = 2 × 150 g layers, and ~800 g of cream ≈ 400 g per layer. The serving count of 8 now holds. *(precision)*
3. **Cook the yolks into a sabayon** *(if you change only these)* - raw yolks whisked with sugar → yolks and sugar whisked over a bain-marie to ~70 °C until thick and ribbony. This pasteurises the yolks, which reduces the salmonella risk the original only addresses with "use fresh eggs", and the cooked base is thicker and holds the mascarpone better. *(food science, feasibility)*
4. **Whites to stiff peaks, with a pinch of salt** - soft peaks → stiff peaks. Whites that will be folded into a heavy cream need firm structure, or they collapse and the tiramisu weeps. The salt helps the foam form faster and hold. *(technique)*
5. **Longer chill** - at least 4 hours → at least 6 hours, ideally overnight. The biscuits need the time to absorb moisture from the cream evenly, and the cream to firm up enough to slice cleanly. *(precision)*
6. **Equipment that matches the method** - "baking tray", "baking paper" and "teaspoon" (never used; nothing is baked) → bain-marie bowl, instant-read thermometer, fine sieve for an even cocoa dusting, grater, and the dish with its size. *(precision, feasibility)*
7. **Sugar all into the yolks** - 1 tbsp in each bowl → all 100 g into the cooked yolk base. The sugar is what lets the yolks be heated to 70 °C without scrambling, and the whites whip fine without it. *(food science)*

## Kept as is

- Coffee as the soaking liquid, cooled completely before dipping.
- The quick 1–2 second dip per side - exactly right, over-soaking is the most common tiramisu failure.
- Cocoa dusting and grated dark chocolate as the finish; icing sugar as an optional extra.
- No alcohol: Marsala, dark rum or coffee liqueur are common additions, but leaving them out is a legitimate choice, and it keeps the dessert family-friendly.
- The serving suggestion (Vin Santo or espresso) and the byline "Adapted from Vincenzo's Plate".

## Taste & check

- **The yolk base:** stop at about 70 °C. Much hotter and the yolks start to scramble at the edges of the bowl. It should fall in a thick ribbon that sits on the surface for a moment.
- **Cool before folding:** the yolk base has to be at room temperature before the mascarpone goes in, or the mascarpone can turn grainy or split.
- **Food safety:** the yolks are pasteurised by the sabayon step, but the whites stay raw. For pregnant, elderly, very young or immunocompromised guests, use pasteurised egg whites. (A fully cooked version would whip the whites as an Italian meringue with hot sugar syrup, which is more effort than Pro Home calls for.)
- **Biscuit quality:** proper dry, crisp Savoiardi absorb coffee evenly; soft supermarket sponge fingers go soggy in a second, so dip them even more briefly.
- **Sweetness:** taste the finished cream before assembling. With strong, bitter coffee, 100 g sugar is about right; if the coffee is milder, you can go down to 80 g.

## Format & validation

- Written in the soowee recipe format (same frontmatter keys, `{timer:}`, `{wait:}`, `{amount}` and `tip:` markup as Lasagna and Fish & Chips).
- Validated by building the site with it: the only failures are the missing `image` and `imageAlt`. With a stand-in image added, the build passes, including the wait-time rule (375 min of `{wait:}` vs. a total of 415 min, so 40 min active).
- **Before this goes on the site**, it needs a real photo in `src/assets/recipes/` and the `image`, `imageAlt` and `imageCredit` fields filled in. The original PDF's source link wasn't readable, so `source.url` is left out rather than guessed.

## Sources

From knowledge, no live research.

For how tiramisu is made in Treviso and the Veneto - layers, Marsala or not, raw versus cooked eggs - ask for the Authentic version.
