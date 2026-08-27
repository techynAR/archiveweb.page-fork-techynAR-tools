const CDP = require('chrome-remote-interface');
async function test() {
    let client;
    try {
        client = await CDP();
        const { Page } = client;
        await Page.enable();
        const tree = await Page.getFrameTree();
        console.log(JSON.stringify(tree, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        if (client) {
            await client.close();
        }
    }
}
test();
