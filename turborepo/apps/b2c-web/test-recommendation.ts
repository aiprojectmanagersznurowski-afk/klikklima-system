import { getRecommendation } from './app/actions/getRecommendation';

async function run() {
  const res = await getRecommendation(3, {1: "Do 20 m²", 2: "Do 20 m²", 3: "Do 20 m²"}, "KJCAL");
  console.log(JSON.stringify(res, null, 2));
}

run();
