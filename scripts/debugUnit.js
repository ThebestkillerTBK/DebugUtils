const ability = require("hackability");
const InvincibleForceFieldAbility = (radius, regen, max, cooldown) => {

    var realRad;
    var paramUnit;
    var paramField;
    var shieldConsumer = cons(trait => {
        if (trait.team != paramUnit.team
            && trait.type.absorbable
            && Intersector.isInsideHexagon(paramUnit.x, paramUnit.y, realRad * 2, trait.x, trait.y)
            && paramUnit.shield > 0) {

            trait.absorb();
            Fx.absorb.at(trait);

            paramField.alpha = 1;
        }
    });

    const ability = new JavaAdapter(ForceFieldAbility, {
        update(unit) {
            unit.shield = Infinity;
            this.radiusScale = Mathf.lerpDelta(this.radiusScale, 1, 0.06)
            realRad = this.radiusScale * this.radius;
            paramUnit = unit;
            paramField = this;
            Groups.bullet.intersect(unit.x - realRad, unit.y - realRad, realRad * 2, realRad * 2, shieldConsumer);
            this.alpha = Math.max(this.alpha - Time.delta / 10, 0);
        },
        copy() {
            return InvincibleForceFieldAbility(radius, regen, max, cooldown);
        },
        draw(unit) {
            this.super$draw(unit);
        },
    }, radius, regen, max, cooldown);

    return ability;
};

const getMessage = (type, key, msgs) =>
    Vars.headless
        ? ''
        : Core.bundle.format(type + "." + exports.modName + "." + key, msgs || []);


const newDeflectForceFieldAbility = (() => {

    let realRad;
    let paramUnit;
    let paramField;
    let paramOptions;

    function deflect(paramUnit, chanceDeflect, bullet) {
        //deflect bullets if necessary
        if (chanceDeflect > 0) {
            let { team } = paramUnit;
            let { deflectAngle, deflectSound } = paramOptions;
            //slow bullets are not deflected
            if (bullet.vel.len() <= 0.1 || !bullet.type.reflectable) return false;

            //bullet reflection chance depends on bullet damage
            if (!Mathf.chance(chanceDeflect / bullet.damage)) return false;

            //make sound
            deflectSound.at(paramUnit, Mathf.random(0.9, 1.1));

            //translate bullet back to where it was upon collision
            bullet.vel.x *= -1;
            bullet.vel.y *= -1;
            // Add a random angle
            bullet.vel.setAngle(Mathf.random(deflectAngle) - deflectAngle / 2 + bullet.vel.angle());

            bullet.owner = paramUnit;
            bullet.team = team;
            bullet.time = (bullet.time + 1);

            return true;
        }
        return false;
    }

    const shieldConsumer = cons(trait => {
        if (paramUnit && paramField && paramUnit
            && trait.team != paramUnit.team
            && trait.type.absorbable
            && paramUnit.shield > 0
            && Intersector.isInsideHexagon(paramUnit.x, paramUnit.y, realRad * 2, trait.x, trait.y)) {
            if (!deflect(paramUnit, paramOptions.chanceDeflect, trait)) {
                trait.absorb();
                Fx.absorb.at(trait);
            }
            //break shield
            if (paramUnit.shield <= trait.damage) {
                paramUnit.shield -= paramOptions.cooldown * paramOptions.regen;
                Fx.shieldBreak.at(paramUnit.x, paramUnit.y, paramOptions.radius || 0, paramUnit.team.color);
            }

            paramUnit.shield -= trait.damage;
            paramField.setAlpha(1);
        }
    });

    const createAbility = (originOptions) => {

        const options = Object.assign({
            radius: 60,
            regen: 0.1,
            max: 200,
            cooldown: 60 * 5,
            chanceDeflect: 10,
            deflectAngle: 60,
            deflectSound: Sounds.none,
            shieldColor: Color.valueOf("92a2dc"),
        }, originOptions);

        let radiusScale = 0;
        let alpha = 0;

        function checkRadius(unit) {
            let r = radiusScale * options.radius;
            realRad = r;
            return r;
        }

        return new JavaAdapter(Ability, {
            setAlpha(a) { alpha = a; },
            localized() {
                return getMessage('ability', 'deflect-force-field');
            },
            update(unit) {
                if (unit.shield < options.max) {
                    unit.shield += Time.delta * options.regen;
                }
                alpha = Math.max(alpha - Time.delta / 10, 0);
                if (unit.shield > 0) {
                    radiusScale = Mathf.lerpDelta(radiusScale, 1, 0.06);
                    paramUnit = unit;
                    paramField = this;
                    paramOptions = options;
                    checkRadius(unit);

                    Groups.bullet.intersect(unit.x - realRad, unit.y - realRad, realRad * 2, realRad * 2, shieldConsumer);
                } else {
                    radiusScale = 0;
                }
            },
            draw(unit) {
                let r = checkRadius(unit);
                if (unit.shield > 0) {
                    Draw.z(Layer.shields);
                    Draw.color(options.shieldColor, Color.white, Mathf.clamp(alpha));
                    if (Core.settings.getBool("animatedshields")) {
                        Fill.poly(unit.x, unit.y, 6, r);
                    } else {
                        Lines.stroke(1.5);
                        Draw.alpha(0.09);
                        Fill.poly(unit.x, unit.y, 6, options.radius);
                        Draw.alpha(1);
                        Lines.poly(unit.x, unit.y, 6, options.radius);
                    }
                }
            },
            copy() {
                return createAbility(options);
            },
        });
    };
    return createAbility;
})();

const a11 = extendContent(UnitType, 'debug-core-unit', {});
a11.abilities.add(new ForceFieldAbility(250, 1500, 50000, 30), new RepairFieldAbility(1500, 30, 250));
a11.abilities.add(new ShieldRegenFieldAbility(1500, 5000, 60, 250));
a11.abilities.add(
	newDeflectForceFieldAbility({
            radius: 260,
            regen: 60000,
            max: 900000,
            cooldown: 5,
            chanceDeflect: 100
        })
	);
a11.constructor = prov(() => extend(UnitEntity, {}));

a11.abilities.add(new StatusFieldAbility(StatusEffects.overclock, 360, 30, 250), new UnitSpawnAbility(UnitTypes.poly, 60*50, 0, 0));
a11.abilities.add(InvincibleForceFieldAbility(60, Infinity, Infinity, 300));
a11.abilities.add(ability.pointDefenseAbility(0, 0, 1, 450, 99999, "def"),ability.MendFieldAbility(250, 5, 90000));
const light = new MoveLightningAbility(55555, 40, 0.9, 0, 2, 10, Color.valueOf("44ccff"))
light.shootEffect = extend(ParticleEffect,{
          line: true,
          particles: 5,
          lifetime: 30,
          length: 20,
          strokeFrom: 16,
          strokeTo: 0,
          lenFrom: 13,
          lenTo: 0,
          colorFrom: Color.valueOf("ffacac"),
          colorTo: Color.valueOf("a63d3d")
});
a11.abilities.add(light);
a11.immunities = ObjectSet.with(StatusEffects.burning, StatusEffects.freezing,StatusEffects.unmoving, StatusEffects.slow, StatusEffects.wet, StatusEffects.muddy, StatusEffects.melting, StatusEffects.sapped, StatusEffects.tarred, StatusEffects.shocked, StatusEffects.blasted, StatusEffects.corroded, StatusEffects.sporeSlowed, StatusEffects.disarmed);
a11.payloadCapacity = (15 * 15) * Vars.tilePayload;
a11.defaultController = () => new FlyingAI();
