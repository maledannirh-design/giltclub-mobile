import fs from "fs";
import admin from "firebase-admin";
import csv from "csv-parser";

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

const results = [];

fs.createReadStream("skill_migration.csv")
  .pipe(csv())
  .on("data",(row)=>results.push(row))
  .on("end", async ()=>{

    for(const r of results){

      const uid = r.uid;

      const skills = {
        hitTiming: Number(r.hitTiming || 0),
        stance: Number(r.stance || 0),
        griphand: Number(r.griphand || 0),
        basicServe: Number(r.basicServe || 0),
        basicReturnServe: Number(r.basicReturnServe || 0),
        returnVolley: Number(r.returnVolley || 0),
        overhead: Number(r.overhead || 0),
        forehandBasic: Number(r.forehandBasic || 0),
        backhandBasic: Number(r.backhandBasic || 0),
        backhandVolley: Number(r.backhandVolley || 0),
        forehandVolley: Number(r.forehandVolley || 0),
        baselineVolley: Number(r.baselineVolley || 0),
        forehandSpin: Number(r.forehandSpin || 0),
        backhandSpin: Number(r.backhandSpin || 0),
        footwork: Number(r.footwork || 0),
        forehandSlice: Number(r.forehandSlice || 0),
        backhandSlice: Number(r.backhandSlice || 0),
        dribblingShot: Number(r.dribblingShot || 0),
        baselineRally: Number(r.baselineRally || 0),
        lowGroundVolley: Number(r.lowGroundVolley || 0),
        highForehand: Number(r.highForehand || 0),
        highBackhand: Number(r.highBackhand || 0),
        highSlice: Number(r.highSlice || 0),
        flatServe: Number(r.flatServe || 0),
        secondSliceServe: Number(r.secondSliceServe || 0),
        dribblingBaseline: Number(r.dribblingBaseline || 0),
        dropShot: Number(r.dropShot || 0)
      };

      await db.collection("userSkills").doc(uid).set(skills);

      await db.collection("users").doc(uid).update({
        playingLevel: r.level
      });

      console.log("Imported", uid);

    }

    console.log("Migration complete");

});
