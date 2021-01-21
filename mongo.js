const mongo = require('mongodb');
const Semaphore = new (require('async-mutex').Semaphore)(1);
const Mongo = new mongo.MongoClient(
    `mongodb+srv://${process.env.MUSR}:${process.env.MPAS}@${process.env.MURL}/<dbname>?retryWrites=true&w=majority`,
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }
);

function time() {
    return new Date().toLocaleTimeString("en-US", {hour12: false, day: "2-digit", month: "2-digit"})
}

Mongo.connect(err => {
    if(err) console.log(`[${time()}] [MNGO] !! Failed to establish database connection.`);
    else console.log(`[${time()}] [MNGO] Connected.`)
});

var mongoRelease = () => null;

// Call this function before using the Mongo client.
// Save the return value and pass it to ExitMongo when
// all Mongo-related operations are complete!
async function EnterMongo() {
    const [_, release] = await Semaphore.acquire();
    mongoRelease = release;
}

async function ExitMongo() {
    mongoRelease();
}

module.exports = {
    Mongo,
    EnterMongo,
    ExitMongo
}
