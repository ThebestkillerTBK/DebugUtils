const core1 = extendContent(CoreBlock, "debugCore", {
    canBreak(tile) { return Vars.state.teams.cores(tile.team()).size > 1; },
    canReplace(other) { return other.alwaysReplace; },
    canPlaceOn(tile, team) { return true; },
    placeBegan(tile, previous) {},
    beforePlaceBegan(tile, previous) {},
    drawPlace(x, y, rotation, valid) {},
});
core1.buildType = prov(() => new JavaAdapter(CoreBlock.CoreBuild, {damage(damage) {  },handleDamage(tile, amount) { return 0; },}, core1));
core1.buildVisibility = BuildVisibility.sandboxOnly;
