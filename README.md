# Orbit Foundry — Solar Atlas

**Live:** https://drugsuser.github.io/orbit-foundry/

Only the Solar System is available as an initial scenario: the Sun and eight planets. The N-body sandbox tools remain available.

## Explore

- Select a planet in the left navigator to center it at a useful, planet-specific distance.
- Mouse wheel or **+ / −** changes distance smoothly. Close zoom stops outside the tracked body's surface.
- Right-drag to orbit the camera, left-drag to pan, double-click a body to inspect it.
- **Overview / F** fits the full system; **To object** returns to a resolved planet.
- **Space** pauses orbital dynamics. **Stop rotation** separately pauses the visible axial rotation.
- **Demonstration spin** is the default: Earth makes one rotation in 40 wall-clock seconds, even when orbits are paused. Each planet has its own illustrative speed. These compressed speeds are not all accelerated by the same factor.
- **Simulation-time spin** uses sidereal periods in simulation hours. Venus and Uranus have retrograde rotation, represented with axial inclinations greater than 90 degrees, not a second reversal of the spin angle. Spin phases are illustrative, not ephemeris-calibrated.
- Natural lighting keeps day/night. The optional inspection fill helps inspect a dark hemisphere. Earth has a night-city map and a separate cloud layer.

## Visuals and limits

Each planet has its own locally hosted 2K equirectangular map, rather than a recolored Moon or shared banded texture. Jupiter and Saturn are oblate. Saturn has radially mapped transparent rings and an analytic approximate planet shadow; Uranus has faint illustrative ringlets. Planet axial inclinations and sidereal periods are based on NASA fact sheets. The longitude of each rotation axis is illustrative, not a date-specific orientation.

Texture colors are enhanced by their source; the orange Sun image is illustrative, not a white-light photograph. Saturn's ring brightness is normalized for inspection and is not a photometric/scattering simulation. Light intensity is normalized across the Solar System so outer planets remain visible. It does not represent inverse-square brightness, a full atmosphere, radiative transfer, or realistic exposure changes. The terminator follows the actual Sun position and is independent of texture rotation.

Physics remains Newtonian N-body dynamics with softened gravity and an adaptive kick–drift–kick integrator. Contacts use physical radii; minimum on-screen radii are enlarged in system view. This is not an astronomical ephemeris or a general-relativity solver.

## Run

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Desktop width >= 1000px and WebGL are required. No build step or external runtime CDN. Reduced-motion preferences disable automatic demonstration spin and camera flights.

## Assets

See [ASSET_CREDITS.md](ASSET_CREDITS.md) for texture authors, exact sources, and licenses. Three.js 0.180.0 is bundled under MIT in `vendor/`.

## Deployment

GitHub Pages: `main`, root directory, `.nojekyll`.


## Столкновения / solid5

Контакт каменистых тел больше не выбирает мгновенно набор сферических обломков.
Тела хранят исходную оболочку и объединение вырезанных объёмов. На каждом этапе
скользящего пересечения удаляется только материал в пересечении; оставшиеся
части продолжают движение с прежними идентификаторами и физическими радиусами.
Ударник с радиусом меньше 5.5% радиуса цели переходит в приближённую модель
кратерообразования: дно и стенки вырезаются в геометрии, ударник расходуется.

Слева: «Создать» → ударник → масса / радиус / скорость / смещение b.
Для срезания выберите «Планета · радиус Земли», b около 0.72, 50–80 км/с.
Пауза срабатывает после расхождения, не на первом касании. Для малого ударника
кнопка «Рассмотреть вмятину» переносит камеру к реальному кратеру. Кратер от
километрового астероида почти не виден с расстояния всей планеты — масштаб не
завышается. Изменённая форма сохраняется в JSON и локальных сохранениях.

`solid-physics.js` задаёт единое поле sphere-minus-spheres для формы и контакта.
Масса срезаемого вещества оценивается по сетке объёмных проб 36³; для малого
кратера используется аналитический объём. Вырезанная масса переносится в
баллистические облака материала, не превращается в несколько огромных камней.
Линейный импульс учитывается в остатках и облаках. Слабая связь оставшихся тел
использует только срезанный материал, а не глобальный упругий отскок.

`solid-mesh-worker.js` строит настоящую замкнутую поверхность в Worker:
адаптивная радиальная триангуляция для кратеров и поверхностных срезов,
марширующие тетраэдры для глубоких нерадиальных вырезов. Пока новая сетка
строится, физика ждёт; на слабом устройстве это заметно как короткие остановки.
Пределы: 256 вырезов на тело, 180 тел, базовая сетка глубокого выреза 52³.
Численное разрешение объёма и изображения различается; тонкие детали могут
теряться, поверхность края среза может быть фасеточной.

**Ограничения модели:** это кинематическое удаление материала с приближённой
передачей импульса, не SPH и не научный гидрокод. Не моделируются ударные волны,
вязкое течение, расплав, упругая деформация, повторная аккреция облаков, изменение
центра масс и тензора инерции повреждённого тела. Исходный центр и ориентация
ядра фиксируются при контакте. Поэтому результат столкновения двух планет,
особенно лобового или медленного, нельзя считать физическим предсказанием.
Газовые гиганты в режиме контактного удаления также не являются полноценной
газодинамикой. Механическая энергия при контакте не сохраняется; неизображённая
часть считается нагревом и разрушением. Гравитация Ньютона со сглаживанием.

Звёзды и чёрные дыры сохраняют отдельную модель поглощения, а ручной выбор
«Слияние» или «Отскок» по-прежнему включает соответствующий режим. Геометрия
для каменистого контакта используется в режиме «Разрушение / срезание».
